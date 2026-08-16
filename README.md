# DONE

> Don’t buy products. Buy outcomes.

**Live demo:** [done-agentic-commerce.vercel.app](https://done-agentic-commerce.vercel.app)

DONE is a bounded autonomous commerce agent for Singapore. A customer states an outcome in ordinary language, approves one maximum spend, and receives a completed order with an inspectable decision trail and payment proof.

## One-minute demo

1. Ask: “Find me 20 sachets of no-added-sugar coffee, deliver them to my saved SMU address, and keep the total under S$12.”
2. DONE evaluates eligible products using the public [`BEST.md`](public/BEST.md) policy.
3. The customer replies **Yes** once to approve a single-use S$12 mandate.
4. DONE selects the best eligible option, creates the sandbox order once, and shows the receipt and proof.

The current build includes a deterministic commerce engine, hard constraint enforcement, bounded approval, idempotent order creation, a public judge-facing interface, and real sponsor-rail proof.

## What is real

| Layer | Status | Evidence |
|---|---|---|
| Request → evaluation → approval → receipt | Implemented | Run the live demo or local app |
| BEST policy and rejection reasons | Implemented | [`public/BEST.md`](public/BEST.md) |
| Duplicate-order protection | Implemented | Replay control in the proof sheet |
| HTTP 402 challenge and EIP-3009 authorization | Executed in the StraitsX sponsor sandbox | [`phase3-proof.json`](public/phase3-proof.json) |
| 10 test XSGD settlement on Avalanche Fuji | Confirmed on-chain | [Snowtrace transaction](https://testnet.snowtrace.io/tx/0x920f3ee1e61ec5cfac585a86aaf1261dbcc7bab1ec1587e449bac86fd2031335) |
| Card and merchant checkout | Sandbox | Clearly labelled in the interface |
| iMessage bridge and AWS orchestration | Designed next phase | Shown as planned in the architecture diagram |

No real-money merchant purchase is claimed. Mainnet funds were not submitted to the demo flow.

## Architecture

The executable flow and the production direction are captured in [`architecture.drawio`](architecture.drawio). Green components are implemented, amber components are external or sandboxed, and blue dashed components are the AWS/iMessage production path.

Security boundary: private keys, card PAN/CVV, OTPs, and full delivery addresses never enter the model or public UI. The signer accepts only an exact, expiring, single-use mandate; the order API is idempotent.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Use **Play full demo** for the timed flow, or enter the request and approve it manually.

Validation:

```bash
npm run lint
npm run build
```

## Sponsor fit

- **AI Commerce Agents:** natural-language intent becomes a resolved SKU, delivered price, and order.
- **StraitsX Real-World Impact:** a Singapore-dollar-native, auditable experience for everyday purchases.
- **Avalanche x402:** a genuine HTTP 402 payment challenge was authorized with EIP-3009 and settled in test XSGD on Fuji.
- **AWS Best Architected:** the production design isolates the local signing boundary and uses Step Functions, Lambda, Bedrock, DynamoDB, S3, IoT Core, API Gateway, and CloudWatch for reliable orchestration and auditability.

## Repository map

- `app/` — public experience and API routes
- `lib/commerce/` — deterministic catalog evaluation, policy, order engine, and idempotency
- `lib/payments/` — sanitized payment-proof schema and validation
- `public/BEST.md` — human-readable best-option policy
- `public/phase3-proof.json` — public-safe sponsor payment evidence
- `architecture.drawio` — submission architecture source

Built for Agentix Playground by team **DONE**.
