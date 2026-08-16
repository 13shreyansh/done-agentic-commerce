export type PaymentProof = {
  version: "done-x402-proof-v1";
  proofId: string;
  issuedAt: string;
  environment: "sponsor-sandbox";
  capability: string;
  http: {
    initialStatus: 402;
    challengeHeader: "PAYMENT-REQUIRED";
    retryHeader: "PAYMENT-SIGNATURE";
    protocolVersion: number;
    scheme: "exact";
  };
  authorization: {
    transferMethod: "eip3009";
    expiresAt: string;
    nonceHash: string;
  };
  payment: {
    amountSgd: number;
    atomicAmount: string;
    token: "test XSGD";
    tokenContract: string;
    payer: string;
    payTo: string;
  };
  settlement: {
    network: "Avalanche Fuji C-Chain";
    chainId: 43113;
    status: "confirmed";
    transactionHash: string;
    blockNumber: number;
    transferEventVerified: true;
    explorerUrl: string;
  };
  card: {
    environment: "sandbox";
    issued: true;
    canSpendRealMoney: false;
    opaqueIdHash: string;
  };
  mainnet: {
    xsgdBalance: string;
    tokenContract: string;
    action: "not-submitted";
  };
};

export function isPaymentProof(value: unknown): value is PaymentProof {
  if (!value || typeof value !== "object") return false;
  const proof = value as Partial<PaymentProof>;
  return proof.version === "done-x402-proof-v1"
    && proof.environment === "sponsor-sandbox"
    && proof.http?.initialStatus === 402
    && proof.payment?.token === "test XSGD"
    && proof.settlement?.chainId === 43113
    && proof.settlement?.status === "confirmed"
    && proof.settlement?.transferEventVerified === true
    && proof.card?.canSpendRealMoney === false;
}
