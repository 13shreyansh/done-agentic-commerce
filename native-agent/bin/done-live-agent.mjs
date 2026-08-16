#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { password } from "@inquirer/prompts";
import { Wallet, getAddress } from "ethers";
import { recordLiveExecution } from "../lib/aws-audit.mjs";
import { understandShoppingRequest } from "../lib/done-ai.mjs";
import { event, openLiveDashboard, publishLiveState } from "../lib/live-execution.mjs";
import { discoverShopifyProducts } from "../lib/shopify-discovery.mjs";
import { DEFAULT_ADDRESS, settleSponsorSandboxCard } from "../lib/straitsx-sandbox.mjs";

const databasePath = join(homedir(), "Library/Messages/chat.db");
const { values } = parseArgs({
  options: {
    "chat-rowid": { type: "string" },
    "approval-limit": { type: "string" },
    "dashboard-url": { type: "string", default: "http://localhost:3000/live" },
    "open-dashboard": { type: "boolean", default: true },
    wallet: { type: "string", default: "wallet" },
    address: { type: "string", default: DEFAULT_ADDRESS },
    announce: { type: "boolean", default: false },
    "replay-latest": { type: "boolean", default: false },
    "poll-ms": { type: "string", default: "1200" },
  },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlJson(query) {
  const output = execFileSync("/usr/bin/sqlite3", ["-readonly", "-json", databasePath, query], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 10 * 1024 * 1024,
  });
  return output.trim() ? JSON.parse(output) : [];
}

function decodeAttributedBody(hex) {
  if (!hex) return "";
  const bytes = Buffer.from(hex, "hex");
  // macOS has used both a NUL and a version byte immediately after the
  // NSString class name. Match the stable class name and locate the payload
  // marker from there instead of depending on that implementation byte.
  const marker = Buffer.from("NSString", "utf8");
  const markerIndex = bytes.indexOf(marker);
  if (markerIndex < 0) return "";
  const plusIndex = bytes.indexOf(0x2b, markerIndex + marker.length);
  if (plusIndex < 0 || plusIndex + 1 >= bytes.length) return "";
  const first = bytes[plusIndex + 1];
  if (first > 0x7f) return "";
  return bytes.subarray(plusIndex + 2, plusIndex + 2 + first).toString("utf8").trim();
}

function messageText(row) {
  return (row.text || decodeAttributedBody(row.attributedBodyHex || "")).trim();
}

function appleScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function sendMessage(target, body) {
  const script = `
    tell application "Messages"
      set targetService to first service whose service type = iMessage
      set targetBuddy to buddy "${appleScriptString(target)}" of targetService
      send "${appleScriptString(body)}" to targetBuddy
    end tell
  `;
  execFileSync("/usr/bin/osascript", ["-e", script], { stdio: ["ignore", "pipe", "inherit"] });
}

function redact(value) {
  if (value.length < 7) return "configured chat";
  return `${value.slice(0, 3)}…${value.slice(-2)}`;
}

function latestRowId(chatRowId) {
  const rows = sqlJson(`SELECT COALESCE(MAX(m.ROWID), 0) AS maxRowId FROM message m JOIN chat_message_join cmj ON cmj.message_id=m.ROWID WHERE cmj.chat_id=${chatRowId};`);
  return Number(rows[0]?.maxRowId || 0);
}

function latestIncomingRowId(chatRowId) {
  const rows = sqlJson(`SELECT COALESCE(MAX(m.ROWID), 0) AS maxRowId FROM message m JOIN chat_message_join cmj ON cmj.message_id=m.ROWID WHERE cmj.chat_id=${chatRowId} AND m.is_from_me=0 AND m.associated_message_type=0;`);
  return Number(rows[0]?.maxRowId || 0);
}

function incomingMessages(chatRowId, afterRowId) {
  return sqlJson(`
    SELECT m.ROWID AS rowId, COALESCE(m.text, '') AS text, hex(m.attributedBody) AS attributedBodyHex
    FROM message m
    JOIN chat_message_join cmj ON cmj.message_id=m.ROWID
    WHERE cmj.chat_id=${chatRowId}
      AND m.ROWID>${afterRowId}
      AND m.is_from_me=0
      AND m.associated_message_type=0
    ORDER BY m.ROWID ASC;
  `);
}

function isApproval(text) {
  return /^\s*(yes|approve|approved|proceed|go ahead)(\b|\s|[.!])?/i.test(text);
}

const chatRowId = Number(values["chat-rowid"]);
const safetyCeilingSgd = values["approval-limit"] == null
  ? 30
  : Number(values["approval-limit"]);
const pollMs = Number(values["poll-ms"]);
assert(Number.isInteger(chatRowId) && chatRowId > 0, "Pass the private Messages chat row ID with --chat-rowid.");
assert(Number.isFinite(safetyCeilingSgd) && safetyCeilingSgd >= 5 && safetyCeilingSgd <= 30, "Safety ceiling must be S$5-S$30.");
assert(Number.isFinite(pollMs) && pollMs >= 500 && pollMs <= 10000, "Polling interval must be 500-10000 ms.");

const chat = sqlJson(`SELECT ROWID AS rowId, chat_identifier AS target FROM chat WHERE ROWID=${chatRowId} LIMIT 1;`)[0];
assert(chat?.target, `Messages chat ${chatRowId} does not exist.`);
const expectedAddress = getAddress(values.address);
const keystorePath = resolve(`.secrets/${values.wallet}.json`);
const encryptedJson = await readFile(keystorePath, "utf8");
if (!process.env.OPENAI_API_KEY) {
  const openAiApiKey = await password({
    message: "Paste the OpenAI API key for this session (hidden and not saved):",
    mask: "*",
  });
  assert(openAiApiKey.trim(), "The OpenAI API key cannot be empty.");
  process.env.OPENAI_API_KEY = openAiApiKey.trim();
}
const encryptionPassword = await password({
  message: `Unlock ${values.wallet} once for this live session (the password stays only in memory):`,
  mask: "*",
});
const signer = await Wallet.fromEncryptedJson(encryptedJson, encryptionPassword);
assert(signer.address === expectedAddress, `Keystore belongs to ${signer.address}, not ${expectedAddress}.`);

const latestIncoming = latestIncomingRowId(chatRowId);
let lastRowId = values["replay-latest"] && latestIncoming > 0
  ? latestIncoming - 1
  : latestRowId(chatRowId);
let pendingRequest = null;
let processing = false;
let liveState = await publishLiveState({
  version: "done-live-run-v1",
  runId: `waiting-${Date.now()}`,
  stage: "listening",
  truthfulMode: "LIVE DISCOVERY · FUJI TESTNET · REAL AWS · MERCHANT CART HANDOFF",
  request: null,
  approval: null,
  discovery: null,
  payment: null,
  aws: null,
  receipt: null,
  events: [event("listening", "iMessage agent connected", "Waiting for a new customer outcome", "complete")],
});

async function transition(stage, title, detail, patch = {}, kind = "active") {
  liveState = await publishLiveState({
    ...liveState,
    ...patch,
    stage,
    events: [...(liveState.events || []), event(stage, title, detail, kind)],
  });
}

console.log("DONE live agent is running.");
console.log(`Messages: inbound-only watcher on ${redact(chat.target)}`);
console.log(`Wallet:   ${signer.address} (unlocked only in this process)`);
console.log(`AI:       OpenAI ${process.env.DONE_OPENAI_MODEL || "gpt-5.6-luna"} interprets incoming requests`);
console.log(`Approval: the customer's stated budget; hard safety stop at S$${safetyCeilingSgd.toFixed(2)}`);
console.log("Payment:  selected live delivered total in test XSGD on Avalanche Fuji after YES");
console.log("Discovery: live Shun Dat Shopify catalogue with timestamped source evidence");
console.log(`Dashboard: ${values["dashboard-url"]} opens automatically after approval`);
console.log("AWS:      live Lambda → DynamoDB → CloudWatch audit after settlement");
console.log("Merchant: no physical order will be claimed; the available StraitsX card is sandbox-only");
console.log("Press Ctrl-C to lock the wallet and stop the agent.\n");

if (values.announce) {
  sendMessage(chat.target, "DONE live agent is connected. Send a new request here. I will ask for explicit payment permission before any transaction.");
}

const timer = setInterval(async () => {
  if (processing) return;
  const rows = incomingMessages(chatRowId, lastRowId);
  for (const row of rows) {
    lastRowId = Math.max(lastRowId, Number(row.rowId));
    const text = messageText(row);
    if (!text) continue;

    if (!pendingRequest) {
      console.log(`Request received at message ${row.rowId}. Asking the language engine to interpret it.`);
      try {
        const understanding = await understandShoppingRequest({ text, approvalLimitSgd: safetyCeilingSgd });
        console.log(`AI interpretation: ${understanding.summary} (${understanding.modelId})`);
        if (!understanding.isPurchaseRequest) {
          sendMessage(chat.target, understanding.acknowledgment);
          continue;
        }
        const requestedBudgetSgd = Number(understanding.budgetSgd);
        if (!Number.isFinite(requestedBudgetSgd) || requestedBudgetSgd <= 0) {
          sendMessage(chat.target, `${understanding.acknowledgment} What is the maximum total in SGD that I may spend? Nothing was spent.`);
          continue;
        }
        if (requestedBudgetSgd > safetyCeilingSgd) {
          sendMessage(chat.target, `Your S$${requestedBudgetSgd.toFixed(2)} request exceeds this demo's S$${safetyCeilingSgd.toFixed(2)} safety ceiling. Nothing was spent.`);
          continue;
        }
        if (requestedBudgetSgd < 5) {
          sendMessage(chat.target, `The sponsor x402 sandbox requires at least S$5.00. Your S$${requestedBudgetSgd.toFixed(2)} mandate was not accepted and nothing was spent.`);
          continue;
        }
        pendingRequest = { text, rowId: Number(row.rowId), understanding, requestedBudgetSgd };
        liveState = await publishLiveState({
          version: "done-live-run-v1",
          runId: `message-${row.rowId}-${Date.now()}`,
          stage: "approval-required",
          truthfulMode: "LIVE DISCOVERY · FUJI TESTNET · REAL AWS · MERCHANT CART HANDOFF",
          request: understanding,
          approval: { status: "requested", maxSpendSgd: requestedBudgetSgd, source: "iMessage" },
          discovery: null,
          payment: null,
          aws: null,
          receipt: null,
          events: [
            event("intent", "OpenAI interpreted the outcome", understanding.summary, "complete"),
            event("approval-required", "Bounded permission requested", `One use, up to S$${requestedBudgetSgd.toFixed(2)}`, "active"),
          ],
        });
        sendMessage(
          chat.target,
          `${understanding.acknowledgment} Do I have your permission to spend up to S$${requestedBudgetSgd.toFixed(2)}? Reply YES.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Language engine failed: ${message}`);
        sendMessage(chat.target, `I received the request, but my language engine is unavailable: ${message.slice(0, 180)} Nothing was spent.`);
      }
      continue;
    }

    if (!isApproval(text)) {
      sendMessage(chat.target, `Nothing was spent. Reply YES to approve up to S$${pendingRequest.requestedBudgetSgd.toFixed(2)}, or send a new request after restarting the agent.`);
      continue;
    }

    processing = true;
    const request = pendingRequest;
    pendingRequest = null;
    try {
      console.log(`Explicit approval received at message ${row.rowId}. Executing.`);
      sendMessage(chat.target, "Approved. I’m searching the live merchant catalogue, applying your constraints, then paying the best eligible result…");
      await transition("discovering", "Explicit iMessage approval received", `Searching within the S$${request.requestedBudgetSgd.toFixed(2)} mandate`, {
        approval: { status: "approved", maxSpendSgd: request.requestedBudgetSgd, source: "iMessage", messageRowId: Number(row.rowId) },
      }, "complete");
      if (values["open-dashboard"]) openLiveDashboard(values["dashboard-url"]);
      const discoveryProof = await discoverShopifyProducts({
        understanding: request.understanding,
        budgetSgd: request.requestedBudgetSgd,
        onProgress: (status) => console.log(status),
      });
      const selected = discoveryProof.selected;
      await transition("selected", "Live Shopify result selected", `${selected.variantTitle} · S$${selected.deliveredTotalSgd.toFixed(2)} delivered · score ${selected.score}`, {
        discovery: discoveryProof,
      }, "complete");
      sendMessage(chat.target, `I checked ${discoveryProof.totalProducts} live products and evaluated ${discoveryProof.evaluatedVariants} coffee variants. Best eligible result: ${selected.variantTitle} from Shun Dat at S$${selected.deliveredTotalSgd.toFixed(2)} delivered. Paying now: ${selected.productUrl}`);
      await transition("paying", "x402 payment started", `Exact S$${selected.deliveredTotalSgd.toFixed(2)} test-XSGD authorization`, {}, "active");
      const paymentProof = await settleSponsorSandboxCard({
        signer,
        amountSgd: selected.deliveredTotalSgd,
        expectedAddress,
        onProgress: (status) => console.log(status),
      });
      await transition("paid", "Avalanche Fuji settlement confirmed", paymentProof.settlement.transactionHash, {
        payment: paymentProof,
      }, "complete");
      console.log("Fuji settlement confirmed. Invoking AWS.");
      await transition("aws", "AWS audit started", "Lambda validating discovery, mandate, and payment evidence", {}, "active");
      const awsProof = await recordLiveExecution({
        paymentProof,
        requestText: request.text,
        approvalText: text,
        maxSpendSgd: request.requestedBudgetSgd,
        discoveryProof,
      });
      const receipt = {
        status: "execution-confirmed",
        selectedProduct: selected.variantTitle,
        merchant: selected.merchant,
        amountSgd: selected.deliveredTotalSgd,
        productUrl: selected.productUrl,
        cartUrl: selected.cartUrl,
        cartPrepared: true,
        physicalOrderPlaced: false,
        note: "A real Shopify cart handoff was prepared. Physical checkout remains unavailable because the sponsor-issued card is sandbox-only.",
      };
      await transition("complete", "Execution receipt ready", `${selected.variantTitle} · AWS ${awsProof.requestId}`, {
        aws: awsProof,
        receipt,
      }, "complete");
      sendMessage(
        chat.target,
        `DONE — ${selected.variantTitle} selected from the live Shopify catalogue at S$${selected.deliveredTotalSgd.toFixed(2)}. Test XSGD settled on Fuji and AWS recorded the execution. Merchant cart: ${selected.cartUrl} Snowtrace: ${paymentProof.settlement.explorerUrl} AWS request: ${awsProof.requestId}. Physical checkout is not claimed because the sponsor card is sandbox-only.`,
      );
      console.log(`Snowtrace: ${paymentProof.settlement.explorerUrl}`);
      console.log(`AWS request: ${awsProof.requestId}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Execution failed: ${message}`);
      await transition("failed", "Execution stopped safely", message.slice(0, 300), {}, "error").catch(() => {});
      sendMessage(chat.target, `Execution stopped safely: ${message.slice(0, 240)} No merchant order is being claimed.`);
    } finally {
      processing = false;
    }
  }
}, pollMs);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\nDONE live agent stopped; the in-memory wallet is discarded.");
  process.exit(0);
});
