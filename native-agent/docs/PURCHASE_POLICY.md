# Universal Autonomous Purchase Policy — superseded research copy

> **NON-AUTHORITATIVE:** The normative DONE purchase policy now lives in section 12 of [PRD.md](PRD.md). This older copy is retained for research only and must not override the PRD.

The text below is an archived prior draft. The application must **not** load this file as policy. The judge-readable and machine-enforced contract for what DONE may do and what **best** means is `PRD.md`, section 12.

> **Judge answer:** “Best” is not a hidden LLM opinion and it does not always mean cheapest. The agent compiles the user’s request into a bounded mandate, rejects every option that violates a hard constraint, and ranks the survivors using this fixed precedence: the user’s stated objective, the user’s ordered preferences, a published category rubric, then universal tie-breakers. Every fact needs evidence, and every decision produces a signed proof.

## 1. Policy precedence

When two rules conflict, the first applicable source wins:

1. the user’s explicit instructions for this purchase;
2. the user’s saved preference profile;
3. the selected category rubric;
4. the universal defaults in this file.

No lower-level default may weaken a budget, prohibition, safety rule, or other explicit constraint.

```yaml
policy:
  version: "1.0"
  ranking_mode: deterministic_lexicographic
  unknown_critical_fact: reject
  default_maximum_orders: 1
  default_approval_expiry_minutes: 30
  default_substitutions: forbidden
  default_recurring_purchase: forbidden
```

## 2. Compile the request into a purchase mandate

Before searching or spending, convert the request into this structure:

```yaml
mandate:
  outcome: "What the user actually wants accomplished"
  category: "Product, service, travel, food, or another category"
  quantity: 1
  delivery_destination: "Saved destination identifier; never expose the address to the model"
  hard_constraints:
    must_have: []
    must_not_have: []
    maximum_delivered_total: null
    currency: SGD
    latest_acceptable_delivery: null
  objective:
    primary: best_value
    ordered_preferences: []
  substitutions:
    allowed: false
    boundaries: []
  authority:
    maximum_orders: 1
    expires_after_minutes: 30
    autonomous_checkout: false
```

The approved amount is a ceiling, not a target. “Up to S$10” never gives permission to spend S$10 when an equally suitable option costs S$6.

If a missing detail could materially change the item, merchant, safety, delivered total, or destination, the agent asks before approval. Non-material details use the precedence rules above.

## 3. Eligibility gate

A candidate is rejected unless all applicable conditions pass:

1. it fulfils the requested outcome and product/service identity;
2. every `must_have` and `must_not_have` rule has current evidence;
3. it is available in the required quantity;
4. the final delivered total includes item price, tax, fees, shipping, and mandatory add-ons and stays within the cap;
5. delivery time and destination are supported;
6. compatibility, seller, warranty, cancellation, and return requirements pass when relevant;
7. checkout and the available payment rail are supported;
8. the purchase is lawful and not in a restricted or high-risk category;
9. confidence in every critical fact meets the category rubric’s threshold.

Missing, stale, inferred, or contradictory critical information fails closed. An unknown is never converted into a convenient fact.

## 4. Definition of “best”

Only eligible candidates are ranked. Ranking is lexicographic: an earlier rule decides before a later rule is considered.

1. **User-stated objective.** Examples: lowest delivered cost, fastest arrival, highest quality, lowest risk, most sustainable, or a custom metric.
2. **Ordered user preferences.** Evaluate them in the order the user supplied them.
3. **Category utility.** Apply the published rubric for the category and record its inputs. Category-aware does not mean merchant-specific.
4. **Lowest risk-adjusted total cost of ownership.** Include mandatory fees and reasonably knowable downstream costs, not just the headline price.
5. **Earliest acceptable fulfilment.** Prefer a current, explicit delivery estimate over an inference.
6. **Highest transaction confidence.** Prefer verified availability, reputable seller evidence, clear returns, and a reversible purchase.
7. **Stable tie-breaker.** Sort by canonical merchant URL so identical inputs always give the same result.

The model may extract and normalize evidence. It may not invent weights, change the precedence, or rank using an unrecorded factor.

### Category rubrics

The universal policy supplies the decision mechanism; a category rubric supplies the meaning of quality. This is how the same policy works for anything without pretending that a salad, laptop, and flight have identical attributes.

| Category | Example category evidence |
|---|---|
| Fungible goods | exact SKU/specification, usable quantity, unit price, expiry |
| Food/grocery | dietary match, serving size, freshness, delivered unit price |
| Electronics | specification fit, compatibility, warranty, expected life, total ownership cost |
| Travel/transport | door-to-door time, baggage/fees, cancellation terms, reliability |
| Services | scope, credentials, SLA, availability, cancellation terms |

Every rubric must be versioned, deterministic, and visible in the decision proof. If no rubric exists and the candidates are not directly comparable, the agent must ask the user to define the priority rather than fabricate one.

## 5. Approval is a capability, not wallet access

One approval authorizes only the compiled mandate: the permitted outcome, destination, merchants or merchant class, quantity, maximum delivered total, number of orders, substitution rules, and expiry.

After checkout reveals the final total, the payment service authorizes only that exact amount. Unused headroom remains with the user.

The agent must request new approval when:

- the final total exceeds the cap or changes after selection;
- the product, merchant, quantity, destination, or material attribute changes;
- a substitution falls outside the approved boundary;
- login, CAPTCHA, 3DS, OTP, or another human challenge appears;
- checkout creates a subscription, credit agreement, donation, tip, or additional order;
- evidence becomes stale or confidence falls below the required threshold.

## 6. Credential and card isolation

The language model and ranking service must never receive a wallet private key, card PAN, CVV, OTP, browser password, or reusable payment credential.

1. The agent sends an opaque `payment_intent_id` containing the approved merchant, amount, currency, expiry, and use count.
2. A separate payment broker validates the intent and obtains a one-time card or a tokenized reusable credential.
3. A constrained checkout worker fills the payment fields directly. Secrets are excluded from prompts, DOM snapshots, screenshots, traces, analytics, databases, and logs.
4. Each purchase uses an isolated browser context, which is destroyed after the receipt is captured.
5. Stored reusable credentials live only in a PCI-scoped vault or provider token service, encrypted under KMS/HSM-backed keys. The agent sees only a token identifier and last four digits.

A reusable card is therefore reusable by the broker, not readable by the agent. Prefer an exact-amount, merchant-bound, short-lived card whenever the issuer supports it.

## 7. What hashes do—and do not do

A hash does **not** hide a reusable card: checkout needs the original card data, while a hash is one-way. Never store a PAN or CVV by “just hashing” it.

Hashes and signatures are used for audit integrity:

```text
mandate_hash  = SHA-256(canonical_json(mandate))
decision_hash = SHA-256(canonical_json(mandate_hash, candidates, exclusions, winner, final_quote))
receipt       = sign(decision_hash, settlement_reference, merchant_order_reference, timestamp)
```

This proves that the instruction, comparison, quote, settlement, and order belong to the same run and were not altered after approval. A keyed HMAC may fingerprint a provider token for internal deduplication; raw card numbers and CVVs are never part of the audit record.

## 8. Decision proof

Every run records and exposes to the user and judges:

- the original request and compiled mandate;
- the policy and category-rubric versions;
- candidate URLs, evidence, timestamps, and normalized facts;
- every rejection reason;
- the exact comparison that selected the winner;
- the scoped approval, final quote, and approval expiry;
- the x402/XSGD settlement reference when used;
- the merchant order reference, receipt, and final delivered total;
- any pause, challenge, failure, cancellation, or refund;
- the hashes and signature linking the complete run.

## 9. Worked example (not a special rule)

For “Buy at least 20 sachets of no-added-sugar kopi, delivered in Singapore for at most S$10; choose the best value and place one order,” the mandate makes dietary match, quantity, stock, destination, and S$10 delivered total hard constraints. Among eligible products, the grocery rubric compares exact dietary evidence and usable quantity; the universal tie-breakers then prefer the lowest delivered unit cost, earliest delivery, merchant confidence, and canonical URL. The same policy engine uses a different published rubric—not different hidden reasoning—for a laptop, flight, taxi, or service.
