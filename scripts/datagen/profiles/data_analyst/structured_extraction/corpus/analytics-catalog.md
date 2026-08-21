# Analytics catalog

The commerce subject area contains `orders`, `order_items`, `refunds`, `customers`, `products`, and `daily_exchange_rates`. `orders` has one row per order. Its `status` describes the order lifecycle, `ordered_at` is stored in UTC, `customer_id` identifies the purchaser, and `order_currency` gives the currency for order-level amounts. `order_items` has one row per order line and joins to `orders` on `order_id`; product attributes come from `products` through `product_id`.

The customer subject area contains one row per customer in `customers`. Its `status` means current relationship status and can be `active`, `dormant`, or `closed`. Subscription reporting uses `subscriptions`, where `status` means billing state and can be `trialing`, `active`, `past_due`, or `canceled`. Customer status and subscription status are not interchangeable, even when both are presented simply as “status” in a request.

The support subject area contains `tickets` and `ticket_events`. Ticket-level attributes such as queue and created time come from `tickets`; first response and resolution timestamps are derived from ordered `ticket_events`. The sales subject area contains `opportunities`, `accounts`, and `sales_reps`. Opportunity ownership joins through `owner_rep_id`, not through region or employee display name.

Payment processor extracts store `amount_minor` as integer currency subunits. Governed marts expose `amount` in major currency units and always retain `currency`. Exchange rates represent units of USD per unit of source currency and are keyed by source currency and UTC calendar date.
