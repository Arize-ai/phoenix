# Governed metric definitions

Net revenue is captured item revenue after discounts, less refunds recognized on the refund date, excluding tax and shipping. Unless a report explicitly requests constant-currency analysis, non-USD amounts are converted with the daily exchange rate for the recognition date. Gross order value is the pre-refund merchandise amount after discounts; it is a separate metric and is not the executive revenue KPI.

Order count is the distinct count of non-test orders that reached `paid`. Canceled orders remain in the warehouse for audit but do not contribute to order count. Average order value is net revenue divided by order count for the same population and period. Gross margin percentage is net revenue less recognized cost of goods, divided by net revenue; it is undefined when net revenue is zero.

Active customers are distinct customers with at least one paid order in the trailing 28 days ending at the report timestamp. Logo churn is customer subscriptions canceled during the period divided by active subscriptions at the start of the period. Recurring-revenue churn is recurring revenue lost from cancellations and contractions divided by recurring revenue at the start of the period. The two churn measures must be named explicitly.

First-response time runs from ticket creation to the first public agent reply. Resolution time runs from ticket creation to the first resolved event and excludes time after a later reopen. Reopen rate is the share of resolved tickets that receive a reopened event within seven days.
