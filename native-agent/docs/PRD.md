# DONE — Product Direction

> **Don’t buy products. Buy outcomes.**

| | |
|---|---|
| Product | **DONE** |
| Primary track | **AI Commerce Agents** |
| Sponsor targets | **StraitsX Real-World Impact**, **Avalanche x402**, **AWS Best Architected Solution** |
| Demo | Coffee delivered to the user’s saved SMU address |
| Updated | 16 August 2026, Singapore |

## 1. Purpose

This is the source of direction for the build. It fixes the outcome, customer promise, judging story, and safety boundaries. It does not fix every screen, service, schema, or implementation choice.

When a detail is not fixed here, choose the simplest reliable option. If a dependency fails during preflight, replace it without changing the customer promise.

Decision order:

1. reliable one-minute demo;
2. truthful, inspectable proof;
3. clear customer experience;
4. meaningful sponsor use;
5. implementation speed;
6. future extensibility.

## 2. Product outcome

DONE turns one natural-language request into a researched choice, one limited permission, an autonomous purchase, and a receipt.

The user should not need to search listings, compare products, repeat approvals, handle payment credentials, or understand XSGD, Avalanche, x402, and AWS.

The agent should:

- understand the requested outcome and constraints;
- compare suitable choices;
- explain why one is best;
- request one precise approval;
- act only inside that approval; and
- return proof of what actually completed.

The build must tell one coherent story for four judging targets:

- **AI Commerce Agents:** the agent discovers, compares, selects, and buys.
- **StraitsX Real-World Impact:** a nontechnical Singapore user can complete an everyday purchase with XSGD.
- **Avalanche x402:** a working agent payment happens through a machine-readable x402 flow.
- **AWS Best Architected:** AWS materially improves security, reliability, execution, or evidence.

## 3. Canonical coffee demo

The customer story is:

> “Get me 20 sachets of no-added-sugar local coffee, stay within my budget, and deliver it to my saved SMU address. Choose the best option and complete it after I approve.”

The exact wording, quantity, and budget may change after checkout preflight.

The preferred starting candidate is [Train Brand Penang Coffee O — No Sugar Added from Shun Dat](https://www.shundat.com/products/train-brand-penang-coffee-o-no-sugar-added), a Singapore Shopify listing currently showing 20 sachets for S$6.50. Shipping is calculated at checkout, so stock, delivery, and final total must be checked before recording. Use another Singapore coffee product or Shopify merchant if it produces a stronger end-to-end demo.

The experience should feel like:

```text
request in Messages
  → options checked
  → best choice explained
  → one bounded approval
  → payment and checkout
  → receipt and proof
```

Real Apple Messages is preferred. If local permissions make it unreliable, use the existing web conversation and label it honestly.

## 4. Choosing “best”

“Best” must be explainable, not a hidden model opinion.

For coffee, first enforce the user’s hard constraints. Then compare eligible options using the evidence available, normally including:

- product fit;
- delivered price;
- quantity and value;
- stock and delivery to SMU;
- merchant reliability; and
- explicit user preferences.

The agent may choose the exact ranking method, but it must show a short reason such as:

> “This was the lowest delivered price among the available options that matched the coffee, quantity, and delivery requirements.”

The proof view should expose the policy, evidence, winner, and meaningful tradeoffs. The method should be consistent and easy to adapt to another category.

## 5. Permission, safety, and truth

Approval is for one intended purchase, not general control of a wallet or card. Bind it to the important facts known at approval time, including the outcome, maximum total, destination, and a short validity period. The exact mechanism is flexible.

Ask again if the total exceeds the cap, the product or merchant changes materially, the destination changes, or another order would be created. Pause for logins, OTPs, CAPTCHAs, 3-D Secure, or other human challenges.

Never send private keys, seed phrases, reusable card details, or secrets to the model, repository, browser UI, or ordinary logs. Signing and secret use stay in trusted code. Never spend mainnet funds without explicit approval for that exact action.

Every important step should be identifiable as **mainnet**, **testnet**, **sponsor sandbox**, **merchant sandbox**, or **interface simulation**. Say “purchased” or “paid” only when evidence supports it; otherwise say exactly what completed.

## 6. Integration direction

The integrations are parts of one purchase, not four sponsor logos:

- **StraitsX / XSGD:** Singapore-dollar value and payment capability.
- **Avalanche:** settlement and verifiable transaction evidence.
- **x402:** a machine-readable payment request the agent can resolve programmatically.
- **Shopify or another merchant adapter:** product, checkout, and order result.
- **AWS:** reliable execution, secret isolation, duplicate prevention, audit evidence, monitoring, or a public endpoint.

x402 must work inside the flow, but its exact useful role may be chosen after preflight—for example, paid discovery, authorization, or access to a merchant capability.

The event material says XSGD must be used on Avalanche C-Chain mainnet. Include a small, meaningful, verifiable mainnet action when the organizer-provided route supports it. Testnet and sandbox steps may support the build but must be labeled.

Use the smallest useful AWS architecture and show what it actually did. Exact services may change with available credentials and deployment speed.

Use a real retail checkout when a supported route succeeds. If credentials or human challenges block it, use a deterministic merchant sandbox and say so. A truthful sandbox receipt is acceptable; a fabricated real order is not.

## 7. Fixed direction and implementation freedom

These are fixed:

- the **DONE** name and tagline;
- the coffee-to-SMU customer story;
- a transparent recommendation;
- one bounded approval;
- a receipt with inspectable proof;
- one coherent story for the main track and three sponsor awards;
- truthful environment and completion labels; and
- safe secret and spending behavior.

The implementation agent may freely change:

- the exact coffee, merchant, quantity, budget, and final copy;
- live versus sandbox merchant execution;
- the ranking formula and data sources;
- the model, libraries, schemas, APIs, and UI details;
- the exact x402 role;
- AWS services and deployment shape; and
- any internal detail that preserves the fixed direction.

Build one complete coffee journey before adding breadth. Amazon, Grab, Shopee, arbitrary browser control, multiple categories, reusable cards, and CAPTCHA solving are optional only after the core journey is reliable.

## 8. Completion test

The build is ready when a judge can see that:

1. the user requested coffee in natural language;
2. DONE checked multiple plausible choices;
3. the recommendation and meaning of “best” are clear;
4. the user approved one purchase and a maximum amount;
5. the agent continued without unnecessary questions;
6. XSGD, Avalanche, and x402 performed a visible working role;
7. the merchant returned a real or clearly labeled sandbox result;
8. the user received a concise receipt;
9. the proof view exposed payment, authorization, merchant, and environment evidence;
10. AWS performed a real architectural function; and
11. the complete story fit in about one minute.

Failure must also look intentional: no raw stack trace, false success, duplicate payment, or duplicate order.

## 9. Build and presentation order

Build in this order, adapting when a dependency is weak:

1. Preflight the coffee listing, final total, merchant route, Messages access, StraitsX/x402 flow, Avalanche network, and AWS account.
2. Make the full conversation work with deterministic fixtures.
3. Replace fixtures with the strongest working sponsor and merchant integrations.
4. Add proof, environment labels, duplicate prevention, and clean failure states.
5. Rehearse the one-minute path and retain truthful fallbacks.

Presentation arc: **ask → compare → approve → act → prove**.

DONE is finished when a nontechnical person can ask for coffee, understand the choice, approve a limited action, and receive evidence of what the agent actually completed—and a judge can see how the same pattern safely expands to other outcomes.
