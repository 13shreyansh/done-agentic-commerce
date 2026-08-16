# DONE

> **Don’t buy products. Buy outcomes.**

[Product demo](https://done-agentic-commerce.vercel.app/) · [Live evidence console](https://done-agentic-commerce.vercel.app/live) · [Architecture](https://done-agentic-commerce.vercel.app/architecture) · [Latest Fuji proof](https://testnet.snowtrace.io/tx/0x195d69332d96bc8109ddd6f16bf55aaa95e968301d75951e69f7d5fd3733cb5d)

DONE is a bounded autonomous-commerce agent for Singapore. A customer asks for an outcome in ordinary language, sets a maximum spend, and approves once. DONE then discovers live merchant products, applies a public selection policy, pays the exact selected total through StraitsX x402 on Avalanche Fuji, records the execution in AWS, and returns an inspectable receipt.

The demo request is intentionally simple:

> “Find me 20 sachets of no-added-sugar kopi, deliver them to my saved SMU address, and keep the total under S$10.”

The amount is not hard-coded. The OpenAI interpreter extracts the customer's stated budget, the agent asks permission for that ceiling, and the payment is for the selected product's exact delivered total—never automatically for the full allowance.

## The judge flow

1. The customer sends the request from a second Apple ID in the real Messages app.
2. The native Mac agent interprets the item, quantity, constraints, delivery scope, and budget.
3. DONE asks: “Do I have your permission to spend up to S$X?” Nothing executes before an explicit `YES`.
4. After approval, DONE fetches the live Shopify catalogue and records its URL, timestamp, HTTP status, product count, and SHA-256 fingerprint.
5. Hard requirements reject invalid results; the public [`BEST.md`](public/BEST.md) policy ranks the eligible candidates.
6. DONE signs one exact EIP-3009 authorization locally and settles Fuji test XSGD through StraitsX x402.
7. AWS Lambda validates the sanitized evidence, DynamoDB stores it idempotently, and CloudWatch/X-Ray expose execution evidence.
8. Messages receives the selected product, real Shopify cart, Snowtrace URL, and AWS request ID. The hosted `/live` page visualizes the same safe evidence.

## Architecture

[![DONE system architecture](docs/architecture.svg)](docs/architecture.svg)

The editable source is [`architecture.drawio`](architecture.drawio).

| Boundary | Responsibility | Implementation |
|---|---|---|
| Customer | Native iMessage request and explicit approval | macOS Messages + [`native-agent`](native-agent) |
| Intelligence | Intent extraction and acknowledgement | OpenAI via Vercel AI SDK |
| Discovery | Live catalogue fetch, source fingerprint, deterministic candidate evidence | Shopify `products.json` + [`shopify-discovery.mjs`](native-agent/lib/shopify-discovery.mjs) |
| Decision | Hard constraints, BEST ranking, dynamic spending mandate | [`lib/commerce`](lib/commerce), [`BEST.md`](public/BEST.md) |
| Payment | HTTP 402 challenge and EIP-3009 authorization | StraitsX sponsor sandbox |
| Settlement | Exact test-XSGD transfer and public finality | Avalanche Fuji C-Chain, chain ID `43113` |
| Audit | Validation, idempotent persistence, logs and tracing | AWS Lambda, DynamoDB, CloudWatch, X-Ray |
| Presentation | Interactive demo, live evidence console, architecture and proofs | Next.js 16 on Vercel |

## Truthful execution status

| Capability | Status | Evidence |
|---|---|---|
| Native iMessage transport | **Implemented locally** | [`done-live-agent.mjs`](native-agent/bin/done-live-agent.mjs) |
| OpenAI request interpretation | **Implemented locally** | [`done-ai.mjs`](native-agent/lib/done-ai.mjs) |
| Live Shopify discovery and BEST selection | **Implemented locally** | [`shopify-discovery.mjs`](native-agent/lib/shopify-discovery.mjs) |
| Hosted Messages-style walkthrough | **Simulated presentation** | [Product demo](https://done-agentic-commerce.vercel.app/) |
| Dynamic approval and idempotent order engine | **Implemented** | [`app/page.tsx`](app/page.tsx), [`POST /api/orders`](app/api/orders/route.ts) |
| HTTP 402 + EIP-3009 authorization | **Executed in sponsor sandbox** | [`phase3-proof.json`](public/phase3-proof.json) |
| Fuji test-XSGD settlement | **Confirmed on-chain** | [Snowtrace](https://testnet.snowtrace.io/tx/0x195d69332d96bc8109ddd6f16bf55aaa95e968301d75951e69f7d5fd3733cb5d) |
| Lambda + DynamoDB + CloudWatch/X-Ray | **Executed in event AWS account** | [`phase4-proof.json`](public/phase4-proof.json) |
| Merchant handoff | **Real Shopify cart prepared** | Cart URL appears in a completed live receipt |
| Physical retail purchase | **Not claimed** | Sponsor-issued card is explicitly non-spendable sandbox capability |

No mainnet payment is made by the demo. The user's real XSGD balance and all wallet secrets remain outside Vercel, OpenAI, and AWS.

## Security invariants

- The model may propose and explain; it cannot expand its own authority.
- A payment requires an explicit customer message approving the extracted ceiling.
- The selected total must be within the mandate, the sponsor's S$5–S$30 sandbox range, and the local safety ceiling.
- The wallet signs locally. Private keys, seed phrases, card PAN/CVV, OTPs, Apple credentials, and full addresses never enter the model, browser, repository, or AWS.
- Each execution uses a stable idempotency key; replay returns the stored result rather than creating a duplicate.
- Live discovery evidence is content-addressed with SHA-256 before payment.
- The interface distinguishes live, executed, testnet, sandbox, and presentation-only behavior.

## Run the web app

Requires Node.js **22.13 or newer**.

```bash
git clone https://github.com/13shreyansh/done-agentic-commerce.git
cd done-agentic-commerce
npm install
npm run dev:next
```

Open `http://localhost:3000` for the presentation, `/live` for execution evidence, and `/architecture` for the judge diagram.

## Run the native Mac agent

The hosted website cannot and should not access a private Messages database, encrypted wallet, or AWS SSO session. Those boundaries remain in the separate [`native-agent`](native-agent) package:

```bash
npm run agent:install
npm run agent:check
npm run agent:live -- --chat-rowid YOUR_PRIVATE_CHAT_ROW_ID --approval-limit 30
```

See [`native-agent/README.md`](native-agent/README.md) for macOS permissions, wallet import, AWS setup, and the complete operating procedure.

## Validate

```bash
npm run lint
npm test
npm run build:vercel
npm run agent:check
```

## Award fit

- **AI Commerce Agents** — a natural-language outcome becomes live product evidence, a resolved result, bounded permission, payment, and receipt.
- **StraitsX Real-World Impact** — SGD-native everyday commerce becomes auditable without exposing wallet or card secrets.
- **Best Use of x402 on Avalanche** — the project executed an HTTP 402 challenge, locally signed EIP-3009 authorization, and confirmed test-XSGD settlement on Fuji.
- **AWS Best Architected** — Lambda validates the trust boundary; DynamoDB conditional writes provide replay safety; encryption, PITR, TTL, least-privilege IAM, CloudWatch, and X-Ray make the audit recoverable and observable.

## Repository guide

```text
app/                         Hosted Next.js product, live console, architecture, APIs
lib/commerce/                Intent schema, deterministic policy, engine, idempotency
native-agent/                Native iMessage, OpenAI, Shopify, x402, wallet, AWS runtime
public/BEST.md               Human-readable autonomous-selection policy
public/live-execution.json   Sanitized state consumed by the live console
public/phase3-proof.json     Sanitized x402 + Avalanche execution proof
public/phase4-proof.json     Sanitized AWS execution and replay proof
docs/architecture.svg        GitHub-rendered architecture
architecture.drawio          Editable architecture source
```

Built at **Agentix Playground** by team **DONE**.
