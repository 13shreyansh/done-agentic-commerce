# DONE Best-Option Policy

Version: DONE-BEST-v1

## Decision rule

Reject anything that violates the request or spending mandate; rank the remaining options by match, delivered value, quality, and delivery speed.

## Hard requirements

- The product must be in stock and deliverable to the requested region.
- Every explicit product constraint must match.
- The delivered total, including delivery, must remain inside the approved ceiling.
- Missing or ambiguous price data is not eligible for autonomous purchase.

## Ranking of eligible options

- Constraint match — 55 points
- Delivered value — 20 points
- Merchant/product quality — 15 points
- Delivery speed — 10 points

## Determinism

The highest score wins. Ties are resolved by the lower delivered total and then a stable product identifier. The engine records every rejection reason and never silently relaxes a hard requirement.
