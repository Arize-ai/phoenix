# Documented data-quality exceptions

Replacement fulfillment can create a negative `order_items.quantity` row that reverses the original item before a new zero-price replacement line is added. These paired rows are valid and should not be counted as customer refunds without a refund event. Warranty parts can have a zero item price and still carry nonzero cost and shipment activity.

Inventory `on_hand_units` may be positive while `available_units` is negative when reservations exceed sellable stock or units are quarantined after a quality hold. Negative availability is an operational risk signal, not automatically a malformed row. Products with no fulfilled demand in the lookback have undefined days of cover rather than infinite or zero coverage.

Orders with a zero net item amount can represent full promotional credits, approved replacements, or internal goodwill orders. Test orders are marked explicitly with `is_test`; price alone does not identify them. A customer identifier can be null for an approved guest checkout, so customer-level analyses must state whether guest orders are excluded.

Late-arriving refund events can appear after a monthly sales report closes. Governed current reports recognize them on the refund date, while restatement reports may intentionally revise the original sale period. The report type determines which treatment is correct.
