# DONE submission

## Judge links

- Product: https://done-agentic-commerce.vercel.app/
- Live evidence console: https://done-agentic-commerce.vercel.app/live
- Architecture: https://done-agentic-commerce.vercel.app/architecture
- Source: https://github.com/13shreyansh/done-agentic-commerce
- Latest on-chain proof: https://testnet.snowtrace.io/tx/0xe27f11579a800f96d02438cdc2cd823c4dd780d6b6d16b6c56a8cbe82f586914

## What the judge should see

1. A real iMessage asks for an outcome and supplies a maximum SGD total.
2. OpenAI interprets the request, then DONE asks once for explicit permission using that exact ceiling.
3. After `YES`, the live console shows the Shopify endpoint, fetch time, HTTP status, response hash, evaluated candidates, and BEST-policy winner.
4. DONE settles the selected total as Fuji test XSGD through StraitsX x402.
5. AWS Lambda validates the execution; DynamoDB stores it idempotently; CloudWatch/X-Ray expose the audit trail.
6. Messages returns the real cart, Snowtrace proof, and AWS request ID.

## Award fit

- **AI Commerce Agents:** natural-language intent becomes live product evidence, a resolved SKU, bounded approval, payment, and receipt.
- **StraitsX Real-World Impact:** SGD-native everyday commerce with explicit authority and public payment evidence.
- **Avalanche x402:** executed HTTP 402 + EIP-3009 settlement in test XSGD on Fuji.
- **AWS Best Architected:** validation, conditional idempotency, encryption, PITR, TTL, least-privilege IAM, retained logs, and active tracing.

## Truthful boundary

The native iMessage transport, live Shopify discovery, x402 sponsor-sandbox payment, Avalanche Fuji settlement, and AWS audit path are implemented. The hosted home page is a presentation walkthrough; `/live` is the execution-evidence console. The real Shopify cart is prepared, but no physical retail purchase or mainnet payment is claimed because the sponsor-issued card is sandbox-only.
