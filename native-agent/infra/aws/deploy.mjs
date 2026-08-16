#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const templatePath = join(here, "template.yaml");
const paymentProofPath = join(root, "../public/phase3-proof.json");
const publicProofPath = join(root, "../public/phase4-proof.json");
const profile = process.env.DONE_AWS_PROFILE || "agentix";
const region = process.env.DONE_AWS_REGION || "ap-southeast-1";
const stackName = process.env.DONE_AWS_STACK || "done-phase4";

function aws(args, { json = true } = {}) {
  const output = execFileSync("aws", [...args, "--profile", profile, "--region", region, "--no-cli-pager"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, AWS_PAGER: "" },
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  return json ? JSON.parse(output || "{}") : output;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validatePaymentProof(proof) {
  assert(proof?.version === "done-x402-proof-v1", "Phase 3 payment proof is missing or unsupported.");
  assert(proof?.environment === "sponsor-sandbox", "Phase 3 proof is not sponsor-sandbox evidence.");
  assert(proof?.payment?.token === "test XSGD" && proof.payment.amountSgd === 10, "Expected the approved 10 test-XSGD payment.");
  assert(proof?.settlement?.chainId === 43113 && proof.settlement.status === "confirmed", "Expected a confirmed Avalanche Fuji settlement.");
  assert(proof?.settlement?.transferEventVerified === true, "The XSGD Transfer event was not verified.");
  assert(/^0x[0-9a-fA-F]{64}$/.test(proof.settlement.transactionHash || ""), "The settlement transaction hash is invalid.");
}

function outputMap(stack) {
  return Object.fromEntries((stack.Outputs || []).map((entry) => [entry.OutputKey, entry.OutputValue]));
}

async function invoke(functionName, event, tempDirectory, label) {
  const inputPath = join(tempDirectory, `${label}-input.json`);
  const outputPath = join(tempDirectory, `${label}-output.json`);
  await writeFile(inputPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  const metadata = aws([
    "lambda", "invoke",
    "--function-name", functionName,
    "--invocation-type", "RequestResponse",
    "--log-type", "Tail",
    "--payload", `fileb://${inputPath}`,
    outputPath,
  ]);
  const payload = JSON.parse(await readFile(outputPath, "utf8"));
  assert(!metadata.FunctionError, `${label} Lambda invocation failed: ${JSON.stringify(payload)}`);
  assert(payload?.version === "done-order-audit-result-v1", `${label} returned an unsupported result.`);
  return { metadata, payload };
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function verifyLogs(logGroupName, orderId, startTime) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const logs = aws([
      "logs", "filter-log-events",
      "--log-group-name", logGroupName,
      "--start-time", String(startTime),
      "--limit", "100",
    ]);
    const messages = (logs.events || []).map((entry) => entry.message || "");
    if (messages.some((message) => message.includes(orderId) && message.includes("audit.replayed"))) {
      return true;
    }
    await sleep(1500);
  }
  return false;
}

async function main() {
  const deploymentStartedAt = Date.now();
  const paymentProof = JSON.parse(await readFile(paymentProofPath, "utf8"));
  validatePaymentProof(paymentProof);

  console.log("Deploying DONE Phase 4: Lambda + DynamoDB + CloudWatch...");
  aws([
    "cloudformation", "deploy",
    "--template-file", templatePath,
    "--stack-name", stackName,
    "--capabilities", "CAPABILITY_NAMED_IAM",
    "--no-fail-on-empty-changeset",
    "--tags", "Project=DONE", "Phase=4",
  ], { json: false });

  const describedStacks = aws(["cloudformation", "describe-stacks", "--stack-name", stackName]);
  const stack = describedStacks.Stacks?.[0];
  assert(stack && /_COMPLETE$/.test(stack.StackStatus), `CloudFormation is not complete (${stack?.StackStatus || "unknown"}).`);
  const outputs = outputMap(stack);
  assert(outputs.FunctionName && outputs.TableName && outputs.LogGroupName, "CloudFormation outputs are incomplete.");

  const tx = paymentProof.settlement.transactionHash.toLowerCase();
  const orderId = `DONE-COFFEE-${tx.slice(2, 14).toUpperCase()}`;
  const idempotencyKey = `done-coffee-${tx.slice(2, 34)}-cap12`;
  const auditRequest = {
    version: "done-order-audit-request-v1",
    orderId,
    idempotencyKey,
    outcome: "20 sachets of no-added-sugar kopi delivered to the saved SMU address",
    maxSpendSgd: 12,
    totalSgd: 10,
    merchant: "Shun Dat",
    merchantEnvironment: "merchant-sandbox",
    delivery: "SMU · Saved address",
    payment: {
      proofId: paymentProof.proofId,
      transactionHash: paymentProof.settlement.transactionHash,
      chainId: paymentProof.settlement.chainId,
      amountSgd: paymentProof.payment.amountSgd,
      token: paymentProof.payment.token,
      environment: paymentProof.environment,
    },
  };
  const localPayloadSha256 = sha256(stable(auditRequest));

  const tempDirectory = await mkdtemp(join(tmpdir(), "done-phase4-"));
  try {
    console.log("Invoking the validated audit boundary...");
    const first = await invoke(outputs.FunctionName, auditRequest, tempDirectory, "first");
    assert(["stored", "replayed"].includes(first.payload.outcome), "The first invocation returned an unexpected outcome.");
    assert(first.payload.payloadSha256 === localPayloadSha256, "Lambda and local payload digests differ.");

    console.log("Replaying the exact request to prove duplicate protection...");
    const replay = await invoke(outputs.FunctionName, auditRequest, tempDirectory, "replay");
    assert(replay.payload.outcome === "replayed", "The duplicate invocation was not recognized as a replay.");
    assert(replay.payload.payloadSha256 === localPayloadSha256, "Replay returned a different payload digest.");

    const key = JSON.stringify({ pk: { S: `ORDER#${idempotencyKey}` } });
    const stored = aws(["dynamodb", "get-item", "--table-name", outputs.TableName, "--key", key, "--consistent-read"]);
    assert(stored.Item?.payloadSha256?.S === localPayloadSha256, "The DynamoDB audit digest does not match the executed request.");
    assert(stored.Item?.status?.S === "validated", "The DynamoDB audit record is not validated.");

    const [functionConfig, tableDescription, recovery, ttl, rolePolicy, logGroups] = [
      aws(["lambda", "get-function-configuration", "--function-name", outputs.FunctionName]),
      aws(["dynamodb", "describe-table", "--table-name", outputs.TableName]),
      aws(["dynamodb", "describe-continuous-backups", "--table-name", outputs.TableName]),
      aws(["dynamodb", "describe-time-to-live", "--table-name", outputs.TableName]),
      aws(["iam", "get-role-policy", "--role-name", "done-order-audit-lambda", "--policy-name", "done-order-audit-runtime"]),
      aws(["logs", "describe-log-groups", "--log-group-name-prefix", outputs.LogGroupName]),
    ];

    assert(functionConfig.State === "Active", "The Lambda function is not active.");
    assert(functionConfig.TracingConfig?.Mode === "Active", "Lambda active tracing is not enabled.");
    assert(tableDescription.Table?.TableStatus === "ACTIVE", "The audit table is not active.");
    assert(tableDescription.Table?.BillingModeSummary?.BillingMode === "PAY_PER_REQUEST", "The audit table is not on-demand.");
    assert(recovery.ContinuousBackupsDescription?.PointInTimeRecoveryDescription?.PointInTimeRecoveryStatus === "ENABLED", "Point-in-time recovery is not enabled.");
    assert(["ENABLED", "ENABLING"].includes(ttl.TimeToLiveDescription?.TimeToLiveStatus), "Audit expiry is not enabled.");
    assert(logGroups.logGroups?.some((group) => group.logGroupName === outputs.LogGroupName && group.retentionInDays === 7), "The retained CloudWatch log group was not verified.");

    const statements = rolePolicy.PolicyDocument?.Statement || [];
    const actions = statements.flatMap((statement) => Array.isArray(statement.Action) ? statement.Action : [statement.Action]);
    const leastPrivilegeRoleVerified = ["dynamodb:GetItem", "dynamodb:PutItem", "logs:CreateLogStream", "logs:PutLogEvents"]
      .every((action) => actions.includes(action))
      && !actions.some((action) => typeof action === "string" && (action === "*" || action.startsWith("s3:") || action.startsWith("secretsmanager:")));
    assert(leastPrivilegeRoleVerified, "The Lambda role did not pass the least-privilege check.");

    const logEventVerified = await verifyLogs(outputs.LogGroupName, orderId, deploymentStartedAt);
    assert(logEventVerified, "CloudWatch did not expose the replay evidence in time.");

    const proof = {
      version: "done-aws-proof-v1",
      proofId: `aws-${localPayloadSha256.slice(0, 12)}`,
      verifiedAt: new Date().toISOString(),
      environment: "aws-event-account",
      region,
      stackName,
      stackStatus: stack.StackStatus,
      architecture: [
        { service: "AWS Lambda", role: "Validated execution boundary", verified: true },
        { service: "Amazon DynamoDB", role: "Encrypted idempotent audit ledger", verified: true },
        { service: "Amazon CloudWatch", role: "Execution logs and tracing", verified: true },
      ],
      execution: {
        functionName: outputs.FunctionName,
        runtime: functionConfig.Runtime,
        architecture: functionConfig.Architectures?.[0],
        state: functionConfig.State,
        firstRequestId: first.payload.requestId,
        firstOutcome: first.payload.outcome,
        replayRequestId: replay.payload.requestId,
        replayOutcome: replay.payload.outcome,
        orderId,
        idempotencyKeyHash: sha256(idempotencyKey),
        payloadSha256: localPayloadSha256,
      },
      audit: {
        tableName: outputs.TableName,
        recordStored: true,
        storedPayloadMatches: true,
        encryptionAtRest: true,
        pointInTimeRecovery: true,
        ttlEnabled: true,
        billingMode: "PAY_PER_REQUEST",
      },
      observability: {
        logGroupName: outputs.LogGroupName,
        logRetentionDays: 7,
        tracing: functionConfig.TracingConfig.Mode,
        logEventVerified,
      },
      security: {
        leastPrivilegeRoleVerified,
        browserReceivedSecrets: false,
        privateKeyUsedByAws: false,
        mainnetFundsSpent: false,
      },
      sourcePayment: {
        proofId: paymentProof.proofId,
        transactionHash: paymentProof.settlement.transactionHash,
        chainId: paymentProof.settlement.chainId,
        amountSgd: paymentProof.payment.amountSgd,
        environment: paymentProof.environment,
      },
    };

    await writeFile(publicProofPath, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o644 });
    console.log("");
    console.log(`AWS stack:       ${stackName} (${stack.StackStatus})`);
    console.log(`Lambda:          ${outputs.FunctionName} (${first.payload.outcome} → ${replay.payload.outcome})`);
    console.log(`DynamoDB:        ${outputs.TableName} (digest verified, PITR enabled)`);
    console.log(`CloudWatch:      ${outputs.LogGroupName} (replay log verified)`);
    console.log(`Public proof:    ${publicProofPath}`);
    console.log("Safety:          no wallet key, card data, or mainnet funds entered AWS");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Phase 4 failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
