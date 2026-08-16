import { createHash } from "node:crypto";

const STORE_ORIGIN = "https://www.shundat.com";
const CATALOG_URL = `${STORE_ORIGIN}/products.json?limit=250`;
const SHIPPING_EVIDENCE_URL = `${STORE_ORIGIN}/`;

function plainText(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function terms(value = "") {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) || []);
}

function relevantDescription(body, variantTitle) {
  // Several Shopify products expose multiple purchasable variants inside one
  // description as `1.Name`, `2.Name`, etc.  Keep evidence scoped to the
  // matching numbered section; otherwise one variant could inherit another
  // variant's pack size or sugar claim.
  const sections = plainText(body)
    .split(/(?=\b\d{1,2}\s*[.)](?=\s*[a-z]))/i)
    .map((section) => section.trim())
    .filter(Boolean);
  if (sections.length < 2) return plainText(body);
  const variantTerms = terms(variantTitle);
  const ranked = sections
    .map((section) => ({
      section,
      overlap: [...variantTerms].filter((term) => term.length > 2 && terms(section).has(term)).length,
    }))
    .sort((left, right) => right.overlap - left.overlap);
  return ranked[0]?.overlap > 0 ? ranked[0].section : "";
}

function quantityPattern(quantity) {
  if (!quantity) return null;
  return new RegExp(`(?:${quantity}\\s*(?:sachets?|sticks?|packets?|pcs?|pieces?)|(?:x|×)\\s*${quantity}\\b|\\b${quantity}\\s*[sx]\\b)`, "i");
}

function noSugar(value) {
  return /(?:no\s*(?:added\s*)?sugar|sugar[ -]?free|kopi[ -]?o\s+kosong|coffee[ -]?o\s+kosong)/i.test(value);
}

function scoreCandidate(candidate, budgetSgd, requireNoSugar, quantity) {
  const reasons = [];
  if (!candidate.available) reasons.push("Unavailable");
  if (requireNoSugar && !candidate.noAddedSugar) reasons.push("No reliable no-sugar evidence");
  if (quantity && !candidate.quantityMatched) reasons.push(`No reliable ${quantity}-sachet evidence`);
  if (!candidate.deliveryVerified) reasons.push("Delivery price is not machine-verifiable");
  if (candidate.deliveredTotalSgd > budgetSgd) reasons.push(`S$${candidate.deliveredTotalSgd.toFixed(2)} exceeds the S$${budgetSgd.toFixed(2)} mandate`);

  const constraintScore = (requireNoSugar ? (candidate.noAddedSugar ? 30 : 0) : 30)
    + (quantity ? (candidate.quantityMatched ? 25 : 0) : 25);
  const valueScore = candidate.deliveredTotalSgd <= budgetSgd
    ? 15 + (5 * Math.max(0, 1 - candidate.deliveredTotalSgd / budgetSgd))
    : 0;
  const score = Math.round((constraintScore + valueScore + (candidate.available ? 15 : 0) + (candidate.deliveryVerified ? 10 : 0)) * 10) / 10;
  const positiveReasons = [
    candidate.available && "In stock",
    (!requireNoSugar || candidate.noAddedSugar) && "No-added-sugar evidence",
    (!quantity || candidate.quantityMatched) && `${quantity || "Requested"}-unit evidence`,
    candidate.deliveryVerified && "Singapore delivery cost verified",
    candidate.deliveredTotalSgd <= budgetSgd && `S$${candidate.deliveredTotalSgd.toFixed(2)} within mandate`,
  ].filter(Boolean);
  return { ...candidate, eligible: reasons.length === 0, score, reasons: reasons.length ? reasons : positiveReasons };
}

export async function discoverShopifyProducts({ understanding, budgetSgd, onProgress = () => {} }) {
  onProgress(`GET ${CATALOG_URL}`);
  const fetchedAt = new Date().toISOString();
  const [catalogResponse, shippingResponse] = await Promise.all([
    fetch(CATALOG_URL, { headers: { accept: "application/json", "user-agent": "DONE-Agent/1.0" } }),
    fetch(SHIPPING_EVIDENCE_URL, { headers: { accept: "text/html", "user-agent": "DONE-Agent/1.0" } }),
  ]);
  if (!catalogResponse.ok) throw new Error(`Merchant catalogue returned HTTP ${catalogResponse.status}.`);
  const rawCatalog = await catalogResponse.text();
  const shippingHtml = shippingResponse.ok ? await shippingResponse.text() : "";
  const payload = JSON.parse(rawCatalog);
  if (!Array.isArray(payload.products)) throw new Error("Merchant catalogue returned an invalid product list.");

  const shippingText = plainText(shippingHtml);
  const freeShipping = /free shipping singapore islandwide\s*-?\s*no minimum spend/i.test(shippingText);
  const queryText = [understanding.item, understanding.summary, ...(understanding.constraints || [])].filter(Boolean).join(" ");
  const requireNoSugar = noSugar(queryText);
  const quantity = understanding.quantity || null;
  const quantityRegex = quantityPattern(quantity);

  const productCandidates = payload.products
    .filter((product) => /coffee|kopi/i.test(`${product.title} ${plainText(product.body_html)}`))
    .flatMap((product) => (product.variants || []).map((variant) => {
      const evidence = relevantDescription(product.body_html, variant.title);
      const combined = `${product.title} ${variant.title} ${evidence}`;
      const itemPriceSgd = Number(variant.price);
      const deliveryPriceSgd = freeShipping ? 0 : Number.NaN;
      const deliveredTotalSgd = Math.round((itemPriceSgd + (Number.isFinite(deliveryPriceSgd) ? deliveryPriceSgd : 0)) * 100) / 100;
      return {
        id: `${product.id}:${variant.id}`,
        productId: String(product.id),
        variantId: String(variant.id),
        merchant: "Shun Dat",
        title: product.title,
        variantTitle: variant.title,
        available: Boolean(variant.available),
        itemPriceSgd,
        deliveryPriceSgd: Number.isFinite(deliveryPriceSgd) ? deliveryPriceSgd : null,
        deliveredTotalSgd,
        deliveryVerified: freeShipping,
        noAddedSugar: noSugar(combined),
        quantityMatched: quantityRegex ? quantityRegex.test(combined) : true,
        evidence: evidence.slice(0, 360),
        productUrl: `${STORE_ORIGIN}/products/${product.handle}?variant=${variant.id}`,
        cartUrl: `${STORE_ORIGIN}/cart/${variant.id}:1`,
        imageUrl: product.images?.[0]?.src || null,
      };
    }))
    .filter((candidate) => Number.isFinite(candidate.itemPriceSgd) && candidate.itemPriceSgd > 0)
    .map((candidate) => scoreCandidate(candidate, budgetSgd, requireNoSugar, quantity))
    .sort((left, right) => Number(right.eligible) - Number(left.eligible)
      || right.score - left.score
      || left.deliveredTotalSgd - right.deliveredTotalSgd
      || left.id.localeCompare(right.id));

  const selected = productCandidates.find((candidate) => candidate.eligible);
  if (!selected) throw new Error(`No live merchant result satisfies every requirement under S$${budgetSgd.toFixed(2)}.`);
  selected.reasons = ["Selected: highest compliance score, then lowest delivered total", ...selected.reasons];
  const visibleCandidates = [selected, ...productCandidates.filter((candidate) => candidate.id !== selected.id)].slice(0, 8);
  onProgress(`${payload.products.length} products fetched; ${productCandidates.length} coffee variants evaluated; ${selected.variantTitle} selected`);

  return {
    version: "done-live-discovery-v1",
    source: "Shun Dat Shopify catalogue",
    endpoint: CATALOG_URL,
    shippingEvidenceUrl: SHIPPING_EVIDENCE_URL,
    fetchedAt,
    httpStatus: catalogResponse.status,
    totalProducts: payload.products.length,
    evaluatedVariants: productCandidates.length,
    sourceSha256: createHash("sha256").update(rawCatalog).digest("hex"),
    query: { item: understanding.item, quantity, constraints: understanding.constraints, budgetSgd, requireNoSugar },
    policy: {
      name: "BEST v1",
      hardGates: ["In stock", requireNoSugar && "No added sugar", quantity && `Exactly ${quantity} units`, "Verified Singapore delivery", `Delivered total ≤ S$${budgetSgd.toFixed(2)}`].filter(Boolean),
      ranking: "Hard-constraint compliance → delivered value → deterministic product ID tie-break",
    },
    shipping: { freeShipping, evidence: freeShipping ? "Free shipping Singapore islandwide; no minimum spend" : "No verifiable shipping offer found" },
    candidates: visibleCandidates,
    selected,
  };
}

export const SHOPIFY_CATALOG_URL = CATALOG_URL;
