import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  hexlify,
} from "ethers";

export const DEFAULT_ADDRESS = "0x701cBCd4cD9e1F49178c1cc2E62504d9122E032A";
export const MAINNET_RPC = "https://api.avax.network/ext/bc/C/rpc";
export const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
export const MAINNET_XSGD = "0xb2F85b7AB3c2b6f62DF06dE6aE7D09c010a5096E";
export const FUJI_TEST_XSGD = "0xd769410dc8772695a7f55a304d2125320a65c2a5";

const CARD_MCP_SANDBOX = "https://card.straitsx.ai/sandbox/sse";
const CARD_API_SANDBOX = "https://card.straitsx.ai/sandbox/cardapi/issue_card";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

function amount(raw, decimals) {
  const text = raw.toString().padStart(Number(decimals) + 1, "0");
  const cut = text.length - Number(decimals);
  const whole = text.slice(0, cut);
  const fraction = text.slice(cut).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function tokenBalance(provider, contractAddress, holder) {
  const token = new Contract(contractAddress, ERC20_ABI, provider);
  const [raw, decimals, symbol] = await Promise.all([
    token.balanceOf(holder),
    token.decimals(),
    token.symbol(),
  ]);
  return { raw, symbol, formatted: amount(raw, decimals) };
}

async function requestSandboxCardQuote({ amountSgd, cardholderName, walletAddress }) {
  const client = new Client(
    { name: "done-live-imessage-agent", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new SSEClientTransport(new URL(CARD_MCP_SANDBOX));
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "get_card_sandbox",
      arguments: {
        amount_sgd: amountSgd,
        cardholder_name: cardholderName,
        wallet_address: walletAddress,
      },
    });
    const textBlock = result.content?.find((block) => block.type === "text");
    if (!textBlock?.text) throw new Error("The StraitsX Card MCP returned no executable quote.");
    return JSON.parse(textBlock.text);
  } finally {
    await client.close().catch(() => {});
  }
}

function validateChallenge(required, amountSgd) {
  if (required?.x402Version !== 1 || !Array.isArray(required.accepts)) {
    throw new Error("Unsupported x402 challenge version or shape.");
  }
  const accepted = required.accepts.find((entry) => entry.scheme === "exact");
  if (!accepted) throw new Error("The x402 challenge did not offer an exact payment.");
  const expectedAtomicAmount = BigInt(Math.round(amountSgd * 1_000_000)).toString();
  const checks = [
    [accepted.network === "eip155:43113", "network"],
    [Number(accepted.chainId) === 43113, "chain ID"],
    [getAddress(accepted.asset) === getAddress(FUJI_TEST_XSGD), "test XSGD contract"],
    [accepted.amount === expectedAtomicAmount, "exact amount"],
    [accepted.extra?.assetTransferMethod === "eip3009", "EIP-3009 method"],
    [accepted.extra?.name === "XSGD" && accepted.extra?.version === "2", "token domain"],
    [Number(accepted.maxTimeoutSeconds) > 0 && Number(accepted.maxTimeoutSeconds) <= 300, "timeout"],
  ];
  const failed = checks.find(([ok]) => !ok);
  if (failed) throw new Error(`Refusing unexpected x402 ${failed[1]}.`);
  getAddress(accepted.payTo);
  return accepted;
}

export async function settleSponsorSandboxCard({
  signer,
  amountSgd,
  cardholderName = "DONE USER",
  expectedAddress = DEFAULT_ADDRESS,
  privateReceiptPath = resolve(".secrets/sandbox-card.json"),
  publicProofPath = resolve("../public/phase3-proof.json"),
  onProgress = () => {},
}) {
  if (!Number.isFinite(amountSgd) || amountSgd < 5 || amountSgd > 30) {
    throw new Error("The sponsor sandbox requires an amount from S$5 to S$30.");
  }
  const normalizedName = cardholderName.trim().toUpperCase();
  if (!/^[A-Z ]{2,26}$/.test(normalizedName)) {
    throw new Error("Cardholder label must contain only letters and spaces.");
  }
  const payer = getAddress(signer.address);
  if (payer !== getAddress(expectedAddress)) {
    throw new Error(`Unlocked wallet ${payer} does not match ${getAddress(expectedAddress)}.`);
  }

  onProgress("Requesting a machine-readable capability from the StraitsX Card MCP");
  const quote = await requestSandboxCardQuote({
    amountSgd,
    cardholderName: normalizedName,
    walletAddress: payer,
  });
  if (quote?.url !== CARD_API_SANDBOX || quote?.environment?.chain_id !== 43113) {
    throw new Error("The sponsor MCP returned an unexpected endpoint or network.");
  }

  const requestBody = { amount_sgd: amountSgd, cardholder_name: normalizedName };
  const challengeResponse = await fetch(quote.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (challengeResponse.status !== 402) {
    throw new Error(`Expected HTTP 402; received ${challengeResponse.status}.`);
  }
  const paymentRequired = challengeResponse.headers.get("payment-required");
  if (!paymentRequired) throw new Error("HTTP 402 omitted PAYMENT-REQUIRED.");
  const required = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8"));
  const accepted = validateChallenge(required, amountSgd);

  const provider = new JsonRpcProvider(FUJI_RPC, 43113, { staticNetwork: true });
  const [network, testBalance] = await Promise.all([
    provider.getNetwork(),
    tokenBalance(provider, FUJI_TEST_XSGD, payer),
  ]);
  if (network.chainId !== 43113n) throw new Error("Refusing to sign outside Avalanche Fuji.");
  if (testBalance.raw < BigInt(accepted.amount)) {
    throw new Error(`Insufficient test XSGD: ${testBalance.formatted} ${testBalance.symbol}.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: payer,
    to: getAddress(accepted.payTo),
    value: accepted.amount,
    validAfter: String(now - 10),
    validBefore: String(now + Math.min(Number(accepted.maxTimeoutSeconds), 300) - 15),
    nonce: hexlify(randomBytes(32)),
  };
  const authorizationTypes = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };
  onProgress(`Signing one exact ${amountSgd.toFixed(2)} test-XSGD EIP-3009 authorization in memory`);
  const signature = await signer.signTypedData({
    name: accepted.extra.name,
    version: accepted.extra.version,
    chainId: 43113,
    verifyingContract: getAddress(accepted.asset),
  }, authorizationTypes, authorization);
  const paymentEnvelope = {
    x402Version: required.x402Version,
    accepted,
    payload: { signature, authorization },
    extensions: {},
  };

  const paidResponse = await fetch(quote.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "payment-signature": Buffer.from(JSON.stringify(paymentEnvelope)).toString("base64"),
    },
    body: JSON.stringify(requestBody),
  });
  const responseText = await paidResponse.text();
  if (!paidResponse.ok) {
    throw new Error(`Sponsor settlement failed (${paidResponse.status}): ${responseText.slice(0, 300)}`);
  }
  const cardResult = JSON.parse(responseText);
  const settlementTx = cardResult.settlement_tx;
  if (!/^0x[0-9a-fA-F]{64}$/.test(settlementTx || "") || !cardResult.card_opaque_id) {
    throw new Error("The sponsor returned incomplete settlement evidence.");
  }

  onProgress(`Waiting for Fuji confirmation ${settlementTx}`);
  const receipt = await provider.getTransactionReceipt(settlementTx);
  if (!receipt || receipt.status !== 1) throw new Error("The Fuji settlement is not confirmed.");
  const transferInterface = new Interface(ERC20_ABI);
  const transfer = receipt.logs
    .filter((log) => getAddress(log.address) === getAddress(accepted.asset))
    .map((log) => {
      try { return transferInterface.parseLog(log); } catch { return null; }
    })
    .find((event) => event?.name === "Transfer"
      && getAddress(event.args.from) === payer
      && getAddress(event.args.to) === getAddress(accepted.payTo)
      && event.args.value === BigInt(accepted.amount));
  if (!transfer) throw new Error("The expected XSGD Transfer event was not found.");

  const mainnetProvider = new JsonRpcProvider(MAINNET_RPC, 43114, { staticNetwork: true });
  const mainnetBalance = await tokenBalance(mainnetProvider, MAINNET_XSGD, payer);
  const issuedAt = new Date().toISOString();
  const publicProof = {
    version: "done-x402-proof-v1",
    proofId: `done-${settlementTx.slice(2, 14)}`,
    issuedAt,
    environment: "sponsor-sandbox",
    capability: "StraitsX sandbox card issuance",
    http: {
      initialStatus: 402,
      challengeHeader: "PAYMENT-REQUIRED",
      retryHeader: "PAYMENT-SIGNATURE",
      protocolVersion: required.x402Version,
      scheme: accepted.scheme,
    },
    authorization: {
      transferMethod: accepted.extra.assetTransferMethod,
      expiresAt: new Date(Number(authorization.validBefore) * 1000).toISOString(),
      nonceHash: createHash("sha256").update(authorization.nonce).digest("hex"),
    },
    payment: {
      amountSgd,
      atomicAmount: accepted.amount,
      token: "test XSGD",
      tokenContract: getAddress(accepted.asset),
      payer,
      payTo: getAddress(accepted.payTo),
    },
    settlement: {
      network: "Avalanche Fuji C-Chain",
      chainId: 43113,
      status: "confirmed",
      transactionHash: settlementTx,
      blockNumber: receipt.blockNumber,
      transferEventVerified: true,
      explorerUrl: `https://testnet.snowtrace.io/tx/${settlementTx}`,
    },
    card: {
      environment: "sandbox",
      issued: true,
      canSpendRealMoney: false,
      opaqueIdHash: createHash("sha256").update(cardResult.card_opaque_id).digest("hex"),
    },
    mainnet: {
      xsgdBalance: mainnetBalance.formatted,
      tokenContract: getAddress(MAINNET_XSGD),
      action: "not-submitted",
    },
  };
  const privateReceipt = {
    card_opaque_id: cardResult.card_opaque_id,
    settlement_tx: settlementTx,
    wallet_address: payer,
    issued_at: issuedAt,
    note: "Sponsor sandbox only. Never publish this file or card details.",
  };

  await mkdir(dirname(privateReceiptPath), { recursive: true, mode: 0o700 });
  await writeFile(privateReceiptPath, `${JSON.stringify(privateReceipt, null, 2)}\n`, { mode: 0o600 });
  await chmod(privateReceiptPath, 0o600);
  await mkdir(dirname(publicProofPath), { recursive: true });
  await writeFile(publicProofPath, `${JSON.stringify(publicProof, null, 2)}\n`, { mode: 0o644 });
  return publicProof;
}
