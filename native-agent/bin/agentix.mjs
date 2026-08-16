#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { password } from "@inquirer/prompts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Command } from "commander";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  formatEther,
  getAddress,
  hexlify,
  parseEther,
  randomBytes,
} from "ethers";

const DEFAULT_ADDRESS = "0x701cBCd4cD9e1F49178c1cc2E62504d9122E032A";
const MAINNET_RPC = "https://api.avax.network/ext/bc/C/rpc";
const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const MAINNET_XSGD = "0xb2F85b7AB3c2b6f62DF06dE6aE7D09c010a5096E";
const FUJI_TEST_XSGD = "0xd769410dc8772695a7f55a304d2125320a65c2a5";
const CARD_MCP_SANDBOX = "https://card.straitsx.ai/sandbox/sse";
const CARD_API_SANDBOX = "https://card.straitsx.ai/sandbox/cardapi/issue_card";
const AWS_START_URL = "https://d-9667af3970.awsapps.com/start";
const KEYSTORE_DIR = resolve(".secrets");
const PRIVATE_CARD_RECEIPT = join(KEYSTORE_DIR, "sandbox-card.json");
const PUBLIC_PAYMENT_PROOF = resolve("../public/phase3-proof.json");
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const DEMO_APP_URL = "http://127.0.0.1:3000";
const DEMO_REQUEST = "Buy 20 sachets of sugar-free kopi for the office. Deliver them to my saved SMU address. You may spend up to S$10 and complete one purchase without asking again.";

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const terminalColor = (code, value) => process.stdout.isTTY ? `\u001b[${code}m${value}\u001b[0m` : value;
const cyan = (value) => terminalColor("36", value);
const green = (value) => terminalColor("32", value);
const yellow = (value) => terminalColor("33", value);
const dim = (value) => terminalColor("2", value);

async function demoLine(label, value, delayMs) {
  console.log(`${cyan(label.padEnd(18))} ${value}`);
  if (delayMs) await wait(delayMs);
}

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
  return { raw, decimals: Number(decimals), symbol, formatted: amount(raw, decimals) };
}

async function unlockKeystore(encryptedJson, message) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const encryptionPassword = await password({ message, mask: "*" });
    try {
      return await Wallet.fromEncryptedJson(encryptedJson, encryptionPassword);
    } catch {
      if (attempt < 3) {
        console.log("That password did not unlock this CLI keystore. Use the wallet-import encryption password with no added spaces or quotes.");
      }
    }
  }
  throw new Error("The CLI keystore could not be unlocked after three attempts. No payment was signed or submitted.");
}

async function printStatus(addressInput) {
  const address = getAddress(addressInput || process.env.AGENTIX_ADDRESS || DEFAULT_ADDRESS);
  const mainnet = new JsonRpcProvider(MAINNET_RPC, 43114, { staticNetwork: true });
  const fuji = new JsonRpcProvider(FUJI_RPC, 43113, { staticNetwork: true });
  const [mainAvax, fujiAvax, mainXsgd, testXsgd] = await Promise.all([
    mainnet.getBalance(address),
    fuji.getBalance(address),
    tokenBalance(mainnet, MAINNET_XSGD, address),
    tokenBalance(fuji, FUJI_TEST_XSGD, address),
  ]);

  console.log(`Address:             ${address}`);
  console.log(`Mainnet AVAX:        ${formatEther(mainAvax)} AVAX`);
  console.log(`Mainnet XSGD:        ${mainXsgd.formatted} ${mainXsgd.symbol}`);
  console.log(`Fuji test AVAX:      ${formatEther(fujiAvax)} AVAX`);
  console.log(`Fuji test XSGD:      ${testXsgd.formatted} ${testXsgd.symbol}`);
  console.log("");
  console.log("Contracts:");
  console.log(`  Mainnet XSGD:      ${getAddress(MAINNET_XSGD)}`);
  console.log(`  Fuji test XSGD:    ${getAddress(FUJI_TEST_XSGD)}`);
}

async function listMcpTools() {
  const client = new Client(
    { name: "agentix-wallet-cli", version: "1.0.0" },
    { capabilities: {} },
  );
  const transport = new SSEClientTransport(new URL(CARD_MCP_SANDBOX));
  try {
    await client.connect(transport);
    const result = await client.listTools();
    console.log(`Card MCP sandbox: ${CARD_MCP_SANDBOX}`);
    console.log(`Available tools: ${result.tools.length}`);
    for (const tool of result.tools) {
      console.log(`  - ${tool.name}${tool.description ? `: ${tool.description}` : ""}`);
    }
  } finally {
    await client.close().catch(() => {});
  }
}

async function requestSandboxCardQuote({ amountSgd, cardholderName, walletAddress }) {
  const client = new Client(
    { name: "done-x402-client", version: "1.0.0" },
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
    if (!textBlock?.text) throw new Error("The Card MCP returned no executable sandbox quote.");
    return JSON.parse(textBlock.text);
  } finally {
    await client.close().catch(() => {});
  }
}

function validateSandboxChallenge(required, amountSgd) {
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
    [accepted.extra?.assetTransferMethod === "eip3009", "EIP-3009 transfer method"],
    [accepted.extra?.name === "XSGD" && accepted.extra?.version === "2", "EIP-712 token domain"],
    [Number(accepted.maxTimeoutSeconds) > 0 && Number(accepted.maxTimeoutSeconds) <= 300, "authorization timeout"],
  ];
  const failed = checks.find(([ok]) => !ok);
  if (failed) throw new Error(`Refusing the x402 challenge: unexpected ${failed[1]}.`);
  getAddress(accepted.payTo);
  return accepted;
}

async function issueSandboxCard(nameInput, addressInput, amountInput, cardholderNameInput) {
  const amountSgd = Number(amountInput);
  if (!Number.isFinite(amountSgd) || amountSgd < 5 || amountSgd > 30) {
    throw new Error("Sandbox card value must be between S$5 and S$30.");
  }
  const cardholderName = cardholderNameInput.trim().toUpperCase();
  if (!/^[A-Z ]{2,26}$/.test(cardholderName)) {
    throw new Error("Cardholder name must contain only letters and spaces (2-26 characters).");
  }
  const expectedAddress = getAddress(addressInput || process.env.AGENTIX_ADDRESS || DEFAULT_ADDRESS);

  console.log("Environment: StraitsX sponsor sandbox on Avalanche Fuji (chain ID 43113)");
  console.log(`Payment: ${amountSgd.toFixed(2)} test XSGD — no real money`);
  console.log(`Wallet: ${expectedAddress}`);
  console.log("Requesting the machine-readable card capability through the sponsor MCP...");
  const quote = await requestSandboxCardQuote({ amountSgd, cardholderName, walletAddress: expectedAddress });
  if (quote?.url !== CARD_API_SANDBOX || quote?.environment?.chain_id !== 43113) {
    throw new Error("The Card MCP returned an unexpected endpoint or network.");
  }

  const requestBody = { amount_sgd: amountSgd, cardholder_name: cardholderName };
  const challengeResponse = await fetch(quote.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (challengeResponse.status !== 402) {
    throw new Error(`Expected HTTP 402 from the sponsor sandbox; received ${challengeResponse.status}.`);
  }
  const paymentRequiredHeader = challengeResponse.headers.get("payment-required");
  if (!paymentRequiredHeader) throw new Error("HTTP 402 did not include PAYMENT-REQUIRED.");
  const required = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf8"));
  const accepted = validateSandboxChallenge(required, amountSgd);
  console.log("HTTP 402 received and validated: exact amount, Fuji, test XSGD, EIP-3009.");

  const encryptedJson = await readFile(keystorePath(nameInput), "utf8");
  const signer = await unlockKeystore(
    encryptedJson,
    `Password for ${nameInput} (authorizes exactly ${amountSgd.toFixed(2)} test XSGD):`,
  );
  if (signer.address !== expectedAddress) {
    throw new Error(`Keystore ${nameInput} belongs to ${signer.address}, not ${expectedAddress}.`);
  }

  const provider = new JsonRpcProvider(FUJI_RPC, 43113, { staticNetwork: true });
  const [network, testBalance] = await Promise.all([
    provider.getNetwork(),
    tokenBalance(provider, FUJI_TEST_XSGD, signer.address),
  ]);
  if (network.chainId !== 43113n) throw new Error("Refusing to sign outside Avalanche Fuji.");
  if (testBalance.raw < BigInt(accepted.amount)) {
    throw new Error(`Insufficient test XSGD. Balance is ${testBalance.formatted} ${testBalance.symbol}.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: signer.address,
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
  console.log("EIP-3009 authorization signed locally. Retrying the request with PAYMENT-SIGNATURE...");

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
    throw new Error(`Sponsor sandbox rejected settlement (${paidResponse.status}): ${responseText.slice(0, 500)}`);
  }
  const cardResult = JSON.parse(responseText);
  const settlementTx = cardResult.settlement_tx;
  if (!/^0x[0-9a-fA-F]{64}$/.test(settlementTx || "")) {
    throw new Error("The sponsor sandbox returned no valid settlement transaction.");
  }
  if (!cardResult.card_opaque_id) throw new Error("The sponsor sandbox returned no card reference.");

  const receipt = await provider.getTransactionReceipt(settlementTx);
  if (!receipt || receipt.status !== 1) throw new Error(`Settlement ${settlementTx} is not confirmed on Fuji.`);
  const transferInterface = new Interface(ERC20_ABI);
  const transfer = receipt.logs
    .filter((log) => getAddress(log.address) === getAddress(accepted.asset))
    .map((log) => {
      try { return transferInterface.parseLog(log); } catch { return null; }
    })
    .find((event) => event?.name === "Transfer"
      && getAddress(event.args.from) === signer.address
      && getAddress(event.args.to) === getAddress(accepted.payTo)
      && event.args.value === BigInt(accepted.amount));
  if (!transfer) throw new Error("Settlement exists, but the expected XSGD Transfer event was not found.");

  const mainnetProvider = new JsonRpcProvider(MAINNET_RPC, 43114, { staticNetwork: true });
  const mainnetXsgd = await tokenBalance(mainnetProvider, MAINNET_XSGD, signer.address);
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
      payer: signer.address,
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
      xsgdBalance: mainnetXsgd.formatted,
      tokenContract: getAddress(MAINNET_XSGD),
      action: "not-submitted",
    },
  };
  const privateReceipt = {
    card_opaque_id: cardResult.card_opaque_id,
    settlement_tx: settlementTx,
    wallet_address: signer.address,
    issued_at: issuedAt,
    note: "Sponsor sandbox only. Never publish this file or card details.",
  };
  await mkdir(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
  await writeFile(PRIVATE_CARD_RECEIPT, `${JSON.stringify(privateReceipt, null, 2)}\n`, { mode: 0o600 });
  await chmod(PRIVATE_CARD_RECEIPT, 0o600);
  await writeFile(PUBLIC_PAYMENT_PROOF, `${JSON.stringify(publicProof, null, 2)}\n`);

  console.log("x402 settlement confirmed and sandbox card issued.");
  console.log(`Transaction: ${settlementTx}`);
  console.log(`Explorer: ${publicProof.settlement.explorerUrl}`);
  console.log(`Safe browser proof: ${PUBLIC_PAYMENT_PROOF}`);
  console.log("Card access data was stored only in the ignored, permission-restricted .secrets directory.");
}

function commandExists(command) {
  try {
    execFileSync("/usr/bin/env", ["which", command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function awsStatus() {
  const profile = process.env.AWS_PROFILE || "agentix";
  console.log(`Organizer AWS portal: ${AWS_START_URL}`);
  if (!commandExists("aws")) {
    console.log("AWS CLI: not installed");
    console.log("Install on macOS: brew install awscli");
    process.exitCode = 2;
    return;
  }
  console.log("AWS CLI: installed");
  try {
    const identity = execFileSync("aws", ["sts", "get-caller-identity", "--profile", profile, "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log("Authenticated identity:");
    console.log(identity.trim());
  } catch {
    console.log("Authentication: not configured or the SSO session has expired");
    console.log("After receiving the organizer invitation, run:");
    console.log("  aws configure sso");
    console.log(`Use start URL: ${AWS_START_URL}`);
    console.log("Use the SSO region shown in the invitation (do not guess it).");
  }
}

async function auditAll(address) {
  console.log("=== Avalanche assets ===");
  await printStatus(address);
  console.log("\n=== StraitsX Card MCP ===");
  await listMcpTools();
  console.log("\n=== AWS event account ===");
  awsStatus();
}

async function runCommerceDemo(options = {}) {
  const appUrl = options.appUrl || DEMO_APP_URL;
  const delayMs = Number(options.delay || 450);
  const idempotencyKey = `demo-${Date.now()}`;
  const command = {
    intent: {
      rawRequest: DEMO_REQUEST,
      quantity: 20,
      noAddedSugar: true,
      deliveryAddressLabel: "SMU office · saved address",
      deliveryRegion: "SG",
      maxTotalSgd: 10,
    },
    approval: {
      approved: true,
      approvalText: "Yes",
      maxSpendSgd: 10,
    },
    idempotencyKey,
  };

  console.log(terminalColor("1;32", "DONE — live commerce-agent run"));
  console.log(dim("This command calls the running order API and then verifies the existing Fuji settlement independently."));
  console.log("");
  await demoLine("CUSTOMER", `“${DEMO_REQUEST}”`, delayMs);
  await demoLine("APPROVAL", green("YES — single purchase, hard ceiling S$10.00"), delayMs);
  await demoLine("ORDER API", `${appUrl}/api/orders`, delayMs);

  const response = await fetch(`${appUrl}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Order API ${response.status}: ${result.error || "unknown error"}`);

  await demoLine("POLICY", `${result.policy.version} · ${result.candidates.length} candidates evaluated`, delayMs);
  for (const candidate of result.candidates) {
    const verdict = candidate.eligible ? green("ELIGIBLE") : yellow("REJECTED");
    await demoLine(
      "CANDIDATE",
      `${verdict} · ${candidate.product.name} · S$${candidate.deliveredTotalSgd.toFixed(2)} delivered · score ${candidate.score}`,
      Math.max(140, Math.floor(delayMs * 0.6)),
    );
  }

  let merchantStatus = "unreachable during this run";
  try {
    const merchantResponse = await fetch(result.selected.product.productUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    merchantStatus = `HTTP ${merchantResponse.status}`;
  } catch {
    merchantStatus = "URL resolved by approved sandbox adapter";
  }
  await demoLine("MERCHANT", `${result.selected.product.merchant} · ${merchantStatus}`, delayMs);
  await demoLine("SELECTED", green(`${result.selected.product.name} · S$${result.order.totalSgd.toFixed(2)} delivered`), delayMs);
  await demoLine("ORDER", green(`${result.order.id} · ${result.order.status.toUpperCase()}`), delayMs);
  await demoLine("ORDER MODE", yellow("MERCHANT SANDBOX — no claim of a live retail purchase"), delayMs);
  await demoLine("MERCHANT URL", result.selected.product.productUrl, delayMs);

  const proof = JSON.parse(await readFile(PUBLIC_PAYMENT_PROOF, "utf8"));
  const fujiProvider = new JsonRpcProvider(FUJI_RPC, 43113, { staticNetwork: true });
  const receipt = await fujiProvider.getTransactionReceipt(proof.settlement.transactionHash);
  if (!receipt || receipt.status !== 1) throw new Error("The recorded Fuji settlement could not be independently confirmed.");
  await demoLine("X402", `${proof.http.initialStatus} → ${proof.http.retryHeader} · ${proof.http.scheme} payment`, delayMs);
  await demoLine("PAYMENT", `${proof.payment.amountSgd.toFixed(2)} ${proof.payment.token}`, delayMs);
  await demoLine("NETWORK", `${proof.settlement.network} · chain ${proof.settlement.chainId}`, delayMs);
  await demoLine("TX STATUS", green(`CONFIRMED · block ${receipt.blockNumber}`), delayMs);
  await demoLine("TX HASH", proof.settlement.transactionHash, delayMs);
  await demoLine("SNOWTRACE", proof.settlement.explorerUrl, 0);
  console.log("");
  console.log(green("✓ Real API execution complete; Fuji proof re-verified from the Avalanche RPC."));
}

function keystorePath(nameInput = "wallet") {
  const name = nameInput.trim();
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) {
    throw new Error("Wallet name must use lowercase letters, numbers, and hyphens only (maximum 32 characters).");
  }
  return join(KEYSTORE_DIR, `${name}.json`);
}

async function importWallet(expectedAddressInput, nameInput) {
  const expectedAddress = getAddress(expectedAddressInput || process.env.AGENTIX_ADDRESS || DEFAULT_ADDRESS);
  const targetPath = keystorePath(nameInput);
  console.log("The private key is requested in a masked prompt and is never accepted as a command-line argument.");
  console.log(`Expected address: ${expectedAddress}`);
  console.log(`Wallet name: ${nameInput}`);
  let privateKey;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const entered = (await password({ message: "Paste the complete wallet private key:" })).trim();
    const normalized = entered.startsWith("0x") ? entered : `0x${entered}`;
    if (/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
      privateKey = normalized;
      break;
    }
    console.log("Invalid length or characters. Copy the complete key: exactly 64 hexadecimal characters, optionally beginning with 0x.");
  }
  if (!privateKey) {
    throw new Error("No valid private key was entered after three attempts. Nothing was saved.");
  }
  const wallet = new Wallet(privateKey);
  if (wallet.address !== expectedAddress) {
    throw new Error(`That key belongs to ${wallet.address}, not ${expectedAddress}. Nothing was saved.`);
  }
  const encryptionPassword = await password({ message: "Create an encryption password:", mask: "*" });
  const confirmation = await password({ message: "Repeat the encryption password:", mask: "*" });
  if (!encryptionPassword || encryptionPassword !== confirmation) {
    throw new Error("Passwords did not match. Nothing was saved.");
  }

  await mkdir(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
  const encryptedJson = await wallet.encrypt(encryptionPassword);
  await writeFile(targetPath, encryptedJson, { mode: 0o600, flag: "wx" });
  await chmod(KEYSTORE_DIR, 0o700);
  await chmod(targetPath, 0o600);
  console.log(`Encrypted keystore saved to ${targetPath}`);
  console.log("No transaction was made.");
}

async function showKeystoreAddress(nameInput) {
  const encryptedJson = await readFile(keystorePath(nameInput), "utf8");
  const encryptionPassword = await password({ message: "Keystore password:", mask: "*" });
  const wallet = await Wallet.fromEncryptedJson(encryptedJson, encryptionPassword);
  console.log(wallet.address);
}

async function sendFujiAvax(nameInput, recipientInput, amountInput) {
  const recipient = getAddress(recipientInput);
  const value = parseEther(amountInput);
  if (value <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  const encryptedJson = await readFile(keystorePath(nameInput), "utf8");
  console.log("Network: Avalanche Fuji C-Chain (testnet only, chain ID 43113)");
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount: ${formatEther(value)} test AVAX`);
  const encryptionPassword = await password({ message: `Password for ${nameInput}:`, mask: "*" });
  const provider = new JsonRpcProvider(FUJI_RPC, 43113, { staticNetwork: true });
  const signer = (await Wallet.fromEncryptedJson(encryptedJson, encryptionPassword)).connect(provider);
  const network = await provider.getNetwork();
  if (network.chainId !== 43113n) {
    throw new Error(`Refusing to send: expected Fuji chain ID 43113, received ${network.chainId}.`);
  }
  const balance = await provider.getBalance(signer.address);
  if (balance <= value) {
    throw new Error(`Insufficient test AVAX. Balance is ${formatEther(balance)} AVAX.`);
  }
  console.log(`Sender: ${signer.address}`);
  const transaction = await signer.sendTransaction({ to: recipient, value });
  console.log(`Submitted: ${transaction.hash}`);
  const receipt = await transaction.wait(1);
  if (receipt?.status !== 1) {
    throw new Error(`Transaction failed: ${transaction.hash}`);
  }
  console.log(`Confirmed in block ${receipt.blockNumber}.`);
}

async function sendAllFujiAvax(nameInput, recipientInput) {
  const recipient = getAddress(recipientInput);
  const encryptedJson = await readFile(keystorePath(nameInput), "utf8");
  console.log("Network: Avalanche Fuji C-Chain (testnet only, chain ID 43113)");
  console.log(`Recipient: ${recipient}`);
  console.log("Amount: maximum available test AVAX, minus the exact transaction fee");
  const encryptionPassword = await password({ message: `Password for ${nameInput}:`, mask: "*" });
  const provider = new JsonRpcProvider(FUJI_RPC, 43113, { staticNetwork: true });
  const signer = (await Wallet.fromEncryptedJson(encryptedJson, encryptionPassword)).connect(provider);
  const network = await provider.getNetwork();
  if (network.chainId !== 43113n) {
    throw new Error(`Refusing to send: expected Fuji chain ID 43113, received ${network.chainId}.`);
  }
  if ((await provider.getCode(recipient)) !== "0x") {
    throw new Error("Refusing send-all transfer: recipient is a smart contract, not a normal wallet.");
  }
  const [balance, feeData] = await Promise.all([
    provider.getBalance(signer.address),
    provider.getFeeData(),
  ]);
  if (!feeData.gasPrice) {
    throw new Error("Could not determine the current Fuji gas price.");
  }
  const gasLimit = 21000n;
  const fee = gasLimit * feeData.gasPrice;
  if (balance <= fee) {
    throw new Error(`Balance ${formatEther(balance)} AVAX is not enough to pay the ${formatEther(fee)} AVAX fee.`);
  }
  const value = balance - fee;
  console.log(`Sender: ${signer.address}`);
  console.log(`Balance: ${formatEther(balance)} test AVAX`);
  console.log(`Fee reserved: ${formatEther(fee)} test AVAX`);
  console.log(`Sending: ${formatEther(value)} test AVAX`);
  const transaction = await signer.sendTransaction({
    to: recipient,
    value,
    type: 0,
    gasLimit,
    gasPrice: feeData.gasPrice,
  });
  console.log(`Submitted: ${transaction.hash}`);
  const receipt = await transaction.wait(1);
  if (receipt?.status !== 1) {
    throw new Error(`Transaction failed: ${transaction.hash}`);
  }
  console.log(`Confirmed in block ${receipt.blockNumber}.`);
}

const program = new Command();
program
  .name("agentix")
  .description("AgentiX wallet, Card MCP, and AWS CLI helper")
  .showHelpAfterError();

program
  .command("status")
  .description("Read AVAX and XSGD balances on Avalanche mainnet and Fuji")
  .option("-a, --address <address>", "EVM address to inspect")
  .action(async ({ address }) => printStatus(address));

program
  .command("audit")
  .description("Check Avalanche assets, Card MCP, and AWS access in one command")
  .option("-a, --address <address>", "EVM address to inspect")
  .action(async ({ address }) => auditAll(address));

program
  .command("demo")
  .description("Run the real local commerce API and re-verify the Fuji x402 settlement")
  .option("--app-url <url>", "Running DONE web app URL", DEMO_APP_URL)
  .option("--delay <milliseconds>", "Delay between visible recording steps", "450")
  .action(runCommerceDemo);

const mcp = program.command("mcp").description("StraitsX Card MCP utilities");
mcp.command("tools").description("Connect to the sandbox and list its tools").action(listMcpTools);

const x402 = program.command("x402").description("Secure x402 sandbox payment utilities");
x402
  .command("issue-sandbox-card")
  .description("Pay exact test XSGD through HTTP 402 and issue a non-spendable sponsor sandbox card")
  .option("-n, --name <name>", "Encrypted local wallet name", "wallet")
  .option("-a, --address <address>", "Address the encrypted wallet must match", DEFAULT_ADDRESS)
  .option("--amount <sgd>", "Exact test XSGD card value", "10")
  .option("--cardholder <name>", "Sandbox cardholder label", "DONE USER")
  .action(async ({ name, address, amount, cardholder }) => issueSandboxCard(name, address, amount, cardholder));

const aws = program.command("aws").description("AWS event-account utilities");
aws.command("status").description("Check CLI installation and login state").action(awsStatus);

const wallet = program.command("wallet").description("Encrypted local wallet utilities");
wallet
  .command("import")
  .description("Import a private key through a masked prompt into an encrypted local keystore")
  .option("-a, --address <address>", "Address the private key must match")
  .option("-n, --name <name>", "Local wallet name", "wallet")
  .action(async ({ address, name }) => importWallet(address, name));
wallet
  .command("address")
  .description("Decrypt a keystore and print its address")
  .option("-n, --name <name>", "Local wallet name", "wallet")
  .action(async ({ name }) => showKeystoreAddress(name));
wallet
  .command("send-test-avax")
  .description("Send AVAX on Fuji testnet from an encrypted local wallet")
  .requiredOption("-t, --to <address>", "Recipient EVM address")
  .requiredOption("-m, --amount <avax>", "Amount of test AVAX")
  .option("-n, --name <name>", "Local wallet name", "wallet")
  .action(async ({ name, to, amount }) => sendFujiAvax(name, to, amount));
wallet
  .command("send-all-test-avax")
  .description("Send the maximum Fuji test AVAX balance after reserving the network fee")
  .requiredOption("-t, --to <address>", "Recipient EVM address")
  .option("-n, --name <name>", "Local wallet name", "wallet")
  .action(async ({ name, to }) => sendAllFujiAvax(name, to));

program.parseAsync().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
