import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profile = process.env.DONE_AWS_PROFILE || "agentix";
const region = process.env.DONE_AWS_REGION || "ap-southeast-1";
const stackName = process.env.DONE_AWS_STACK || "done-phase4";

function aws(args) {
  const output = execFileSync("aws", [
    ...args,
    "--profile", profile,
    "--region", region,
    "--no-cli-pager",
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, AWS_PAGER: "" },
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(output || "{}");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function recordLiveExecution({ paymentProof, requestText, approvalText, maxSpendSgd, discoveryProof = null }) {
  if (paymentProof?.settlement?.status !== "confirmed") {
    throw new Error("AWS audit requires a confirmed payment proof.");
  }
  const described = aws(["cloudformation", "describe-stacks", "--stack-name", stackName]);
  const stack = described.Stacks?.[0];
  if (!stack || !/_COMPLETE$/.test(stack.StackStatus || "")) {
    throw new Error(`AWS stack ${stackName} is not ready.`);
  }
  const outputs = Object.fromEntries((stack.Outputs || []).map((entry) => [entry.OutputKey, entry.OutputValue]));
  if (!outputs.FunctionName) throw new Error("AWS stack has no audit Lambda output.");

  const tx = paymentProof.settlement.transactionHash.toLowerCase();
  const event = {
    version: "done-payment-audit-request-v2",
    orderId: `DONE-X402-${tx.slice(2, 14).toUpperCase()}`,
    idempotencyKey: `done-x402-${tx.slice(2, 34)}-imessage`,
    executionType: "x402-sponsor-capability",
    outcome: "StraitsX sandbox card capability issued after explicit iMessage approval",
    maxSpendSgd,
    totalSgd: paymentProof.payment.amountSgd,
    approval: {
      source: "imessage",
      requestSha256: sha256(requestText),
      approvalSha256: sha256(approvalText),
    },
    payment: {
      proofId: paymentProof.proofId,
      transactionHash: paymentProof.settlement.transactionHash,
      chainId: paymentProof.settlement.chainId,
      amountSgd: paymentProof.payment.amountSgd,
      token: paymentProof.payment.token,
      environment: paymentProof.environment,
    },
    discovery: discoveryProof ? {
      source: discoveryProof.source,
      endpoint: discoveryProof.endpoint,
      fetchedAt: discoveryProof.fetchedAt,
      sourceSha256: discoveryProof.sourceSha256,
      selectedProductId: discoveryProof.selected.productId,
      selectedVariantId: discoveryProof.selected.variantId,
      selectedProductUrl: discoveryProof.selected.productUrl,
      selectedTotalSgd: discoveryProof.selected.deliveredTotalSgd,
    } : undefined,
  };

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "done-live-audit-"));
  const inputPath = join(temporaryDirectory, "input.json");
  const outputPath = join(temporaryDirectory, "output.json");
  try {
    await writeFile(inputPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
    const metadata = aws([
      "lambda", "invoke",
      "--function-name", outputs.FunctionName,
      "--invocation-type", "RequestResponse",
      "--log-type", "Tail",
      "--payload", `fileb://${inputPath}`,
      outputPath,
    ]);
    const payload = JSON.parse(await readFile(outputPath, "utf8"));
    if (metadata.FunctionError) throw new Error(`AWS Lambda failed: ${JSON.stringify(payload)}`);
    if (payload?.version !== "done-order-audit-result-v1") {
      throw new Error("AWS Lambda returned an unsupported result.");
    }
    return {
      ...payload,
      functionName: outputs.FunctionName,
      tableName: outputs.TableName,
      logGroupName: outputs.LogGroupName,
      region,
      stackName,
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
