export type AwsProof = {
  version: "done-aws-proof-v1";
  proofId: string;
  verifiedAt: string;
  environment: "aws-event-account";
  region: string;
  stackName: string;
  stackStatus: string;
  architecture: Array<{
    service: "AWS Lambda" | "Amazon DynamoDB" | "Amazon CloudWatch";
    role: string;
    verified: true;
  }>;
  execution: {
    functionName: string;
    runtime: string;
    architecture: string;
    state: "Active";
    firstRequestId: string;
    firstOutcome: "stored" | "replayed";
    replayRequestId: string;
    replayOutcome: "replayed";
    orderId: string;
    idempotencyKeyHash: string;
    payloadSha256: string;
  };
  audit: {
    tableName: string;
    recordStored: true;
    storedPayloadMatches: true;
    encryptionAtRest: true;
    pointInTimeRecovery: true;
    ttlEnabled: true;
    billingMode: "PAY_PER_REQUEST";
  };
  observability: {
    logGroupName: string;
    logRetentionDays: 7;
    tracing: "Active";
    logEventVerified: true;
  };
  security: {
    leastPrivilegeRoleVerified: true;
    browserReceivedSecrets: false;
    privateKeyUsedByAws: false;
    mainnetFundsSpent: false;
  };
  sourcePayment: {
    proofId: string;
    transactionHash: string;
    chainId: 43113;
    amountSgd: number;
    environment: "sponsor-sandbox";
  };
};

export function isAwsProof(value: unknown): value is AwsProof {
  if (!value || typeof value !== "object") return false;
  const proof = value as Partial<AwsProof>;
  return proof.version === "done-aws-proof-v1"
    && proof.environment === "aws-event-account"
    && proof.execution?.state === "Active"
    && proof.execution?.replayOutcome === "replayed"
    && proof.audit?.recordStored === true
    && proof.audit?.storedPayloadMatches === true
    && proof.audit?.pointInTimeRecovery === true
    && proof.observability?.logEventVerified === true
    && proof.security?.leastPrivilegeRoleVerified === true
    && proof.security?.browserReceivedSecrets === false
    && proof.security?.privateKeyUsedByAws === false
    && proof.security?.mainnetFundsSpent === false
    && proof.sourcePayment?.chainId === 43113;
}
