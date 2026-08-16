import type { CandidateEvaluation, CatalogProduct, PurchaseIntent } from "./types";

export const BEST_POLICY = {
  version: "DONE-BEST-v1",
  summary: "Reject anything that violates the request or spending mandate; rank the remaining options by match, delivered value, quality, and delivery speed.",
  hardRules: [
    "The product must be in stock and deliverable to the requested region.",
    "Every explicit product constraint must match.",
    "The delivered total, including delivery, must remain inside the approved ceiling.",
    "Missing or ambiguous price data is not eligible for autonomous purchase.",
  ],
  ranking: [
    "Constraint match — 55 points",
    "Delivered value — 20 points",
    "Merchant/product quality — 15 points",
    "Delivery speed — 10 points",
  ],
} as const;

const money = (value: number) => Math.round(value * 100) / 100;

export function evaluateProduct(product: CatalogProduct, intent: PurchaseIntent): CandidateEvaluation {
  const deliveredTotalSgd = money(product.itemPriceSgd + product.deliveryPriceSgd);
  const reasons: string[] = [];

  if (!product.inStock) reasons.push("Out of stock");
  if (product.deliveryRegion !== intent.deliveryRegion) reasons.push(`Does not deliver to ${intent.deliveryRegion}`);
  if (product.quantity !== intent.quantity) reasons.push(`Quantity is ${product.quantity}, not ${intent.quantity}`);
  if (intent.noAddedSugar && !product.noAddedSugar) reasons.push("Contains added sugar");
  if (deliveredTotalSgd > intent.maxTotalSgd) reasons.push(`Delivered total exceeds S$${intent.maxTotalSgd.toFixed(2)}`);

  const constraintMatch = (product.quantity === intent.quantity ? 30 : 0) +
    (!intent.noAddedSugar || product.noAddedSugar ? 25 : 0);
  const deliveredValue = deliveredTotalSgd <= intent.maxTotalSgd
    ? 15 + 5 * Math.max(0, 1 - deliveredTotalSgd / intent.maxTotalSgd)
    : 0;
  const quality = (product.rating / 5) * 15;
  const delivery = product.deliveryDays <= 1 ? 10 : product.deliveryDays === 2 ? 7 : 3;
  const score = Math.round((constraintMatch + deliveredValue + quality + delivery) * 10) / 10;

  return {
    product,
    deliveredTotalSgd,
    eligible: reasons.length === 0,
    score,
    reasons: reasons.length ? reasons : ["Matches every hard requirement"],
  };
}

export const BEST_POLICY_MARKDOWN = `# DONE Best-Option Policy

Version: ${BEST_POLICY.version}

## Decision rule

${BEST_POLICY.summary}

## Hard requirements

${BEST_POLICY.hardRules.map((rule) => `- ${rule}`).join("\n")}

## Ranking of eligible options

${BEST_POLICY.ranking.map((rule) => `- ${rule}`).join("\n")}

## Determinism

The highest score wins. Ties are resolved by the lower delivered total and then a stable product identifier. The engine records every rejection reason and never silently relaxes a hard requirement.
`;
