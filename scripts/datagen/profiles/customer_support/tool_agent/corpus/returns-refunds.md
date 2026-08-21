# Returns and refund calculations

Effective March 1, 2026, unused standard merchandise is eligible for return within 30 calendar days of delivery. Defective, damaged, and incorrectly fulfilled items are handled even when marked final sale. Marketplace and personalized items retain their product-specific terms.

Expected merchandise refunds are calculated from the paid line-item price after item-level discounts. Tax attributable to the returned merchandise is also refunded. Original standard shipping is excluded. Express shipping can be refunded when the promised window was missed for reasons within the carrier or retailer's control.

Structured payment and refund records normally express `total` and `amount` in the currency's major unit. For USD, `84.50` means eighty-four dollars and fifty cents. An older refund adapter emits whole cents even when the neighboring label still says USD; its value `8450` represents USD 84.50. The refund-event metadata identifies that adapter as `legacy_refund_v1`.

Warehouse inspection normally completes within three business days after receipt. The payment processor then submits the credit, and the customer's bank may take three to seven additional business days to display it.
