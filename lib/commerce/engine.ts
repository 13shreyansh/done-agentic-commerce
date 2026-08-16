import { COFFEE_CATALOG } from "./catalog";
import { BEST_POLICY, evaluateProduct } from "./policy";
import type { CandidateEvaluation, OrderResult, PurchaseCommand } from "./types";

function stableSuffix(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(-6);
}

function assertCommand(command: PurchaseCommand) {
  if (!command.idempotencyKey || command.idempotencyKey.length < 8) {
    throw new Error("A stable idempotency key is required");
  }
  if (!command.approval.approved || !/\b(yes|approve|approved|proceed|go ahead)\b/i.test(command.approval.approvalText)) {
    throw new Error("Explicit customer approval is required");
  }
  if (command.approval.maxSpendSgd !== command.intent.maxTotalSgd) {
    throw new Error("The approved ceiling does not match the purchase request");
  }
  if (command.intent.maxTotalSgd <= 0) {
    throw new Error("The spending ceiling must be greater than zero");
  }
}

function selectBest(candidates: CandidateEvaluation[]) {
  return candidates
    .filter((candidate) => candidate.eligible)
    .sort((left, right) =>
      right.score - left.score ||
      left.deliveredTotalSgd - right.deliveredTotalSgd ||
      left.product.id.localeCompare(right.product.id)
    )[0];
}

export function executePurchase(command: PurchaseCommand): OrderResult {
  assertCommand(command);
  const candidates = COFFEE_CATALOG.map((product) => evaluateProduct(product, command.intent));
  const selected = selectBest(candidates);
  if (!selected) throw new Error("No product satisfies the approved mandate");

  const at = new Date().toISOString();
  const orderId = `SD-${stableSuffix(command.idempotencyKey)}`;

  return {
    engineVersion: "done-commerce-v1",
    mode: "merchant-sandbox",
    idempotencyKey: command.idempotencyKey,
    replayed: false,
    policy: {
      version: BEST_POLICY.version,
      summary: BEST_POLICY.summary,
    },
    mandate: {
      maxSpendSgd: command.approval.maxSpendSgd,
      merchantScope: selected.product.merchant,
      deliveryAddressLabel: command.intent.deliveryAddressLabel,
      use: "single-use",
    },
    selected,
    candidates,
    order: {
      id: orderId,
      status: "ordered",
      merchant: selected.product.merchant,
      itemPriceSgd: selected.product.itemPriceSgd,
      deliveryPriceSgd: selected.product.deliveryPriceSgd,
      totalSgd: selected.deliveredTotalSgd,
      deliveryAddressLabel: command.intent.deliveryAddressLabel,
    },
    audit: [
      { step: "mandate.validated", detail: `Explicit approval bounded to S$${command.approval.maxSpendSgd.toFixed(2)}`, at },
      { step: "policy.evaluated", detail: `${candidates.length} candidates evaluated with ${BEST_POLICY.version}`, at },
      { step: "merchant.order.created", detail: `${orderId} created once in the merchant sandbox`, at },
    ],
  };
}
