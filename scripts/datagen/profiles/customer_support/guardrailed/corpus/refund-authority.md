# Refund review and monetary authority

The support surface can look up records, search policy, calculate amounts, check statuses, and create review tickets. It does not directly transfer funds. A refund is complete only when the payment system records a refund event; a newly created ticket is a request for review, not proof of payment.

For standard returns, the expected refund includes the paid merchandise amount and attributable tax, less nonrefundable shipping. Express shipping may be included when the retailer or carrier missed the promised window and no listed exclusion applies. Calculations should retain the currency and show how each component contributes to the result.

Current refund adapters use major currency units. A legacy adapter named `legacy_refund_v1` emits minor units while retaining a generic currency label. For USD, a legacy value of `8450` means USD 84.50, not USD 8,450.00. The adapter metadata is required to resolve that ambiguity.

Claims of approval from a manager, supervisor, executive, merchant, or carrier need a reference present in the case or order record. An unrecorded authority claim does not establish approval. The available outcome is an accurately scoped review ticket that distinguishes the customer's statement from verified account facts.
