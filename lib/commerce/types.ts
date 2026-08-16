export type PurchaseIntent = {
  rawRequest: string;
  quantity: number;
  noAddedSugar: boolean;
  deliveryAddressLabel: string;
  deliveryRegion: "SG";
  maxTotalSgd: number;
};

export type PurchaseCommand = {
  intent: PurchaseIntent;
  approval: {
    approved: boolean;
    approvalText: string;
    maxSpendSgd: number;
  };
  idempotencyKey: string;
};

export type CatalogProduct = {
  id: string;
  merchant: string;
  merchantType: "shopify-sandbox";
  name: string;
  description: string;
  quantity: number;
  noAddedSugar: boolean;
  inStock: boolean;
  deliveryRegion: "SG";
  itemPriceSgd: number;
  deliveryPriceSgd: number;
  deliveryDays: number;
  rating: number;
  imageUrl: string;
  productUrl: string;
};

export type CandidateEvaluation = {
  product: CatalogProduct;
  deliveredTotalSgd: number;
  eligible: boolean;
  score: number;
  reasons: string[];
};

export type AuditEvent = {
  step: "mandate.validated" | "policy.evaluated" | "merchant.order.created" | "idempotency.replayed";
  detail: string;
  at: string;
};

export type OrderResult = {
  engineVersion: "done-commerce-v1";
  mode: "merchant-sandbox";
  idempotencyKey: string;
  replayed: boolean;
  policy: {
    version: string;
    summary: string;
  };
  mandate: {
    maxSpendSgd: number;
    merchantScope: string;
    deliveryAddressLabel: string;
    use: "single-use";
  };
  selected: CandidateEvaluation;
  candidates: CandidateEvaluation[];
  order: {
    id: string;
    status: "ordered";
    merchant: string;
    itemPriceSgd: number;
    deliveryPriceSgd: number;
    totalSgd: number;
    deliveryAddressLabel: string;
  };
  audit: AuditEvent[];
};
