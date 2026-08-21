# Governed analytics metrics

Net revenue is captured item revenue after discounts, less customer refunds recognized on the refund date, excluding tax and shipping. Non-USD values are converted using the daily exchange rate for the recognition date. Order count is the distinct count of non-test orders that reached paid status. Average order value uses net revenue and order count from the same population.

Gross margin is net revenue less recognized product cost. Gross margin percentage divides gross margin by net revenue and is undefined when net revenue is zero. Replacement reversals adjust item quantities and cost but are not customer refunds unless a corresponding refund event exists.

Sales bookings are the amount of opportunities marked won during the period. Bookings are useful for pipeline reporting but are not recognized revenue. Target attainment is won bookings divided by the representative's target for the same fiscal period. Representative ownership comes from `owner_rep_id` at opportunity close.

Refund rate is customer refund amount divided by net revenue before those refunds for the same recognition window. Fulfillment turnaround is the elapsed time from first successful payment to first carrier acceptance. Customer repeat purchase counts a later paid, non-test order whose paid timestamp falls within the stated number of days after the customer's first eligible paid order.

Inventory days of cover is available units divided by average daily fulfilled demand over the stated lookback. It is undefined for zero demand, and quarantined units are excluded from available units. Results must preserve the reason an item was excluded or left undefined.
