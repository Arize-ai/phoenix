# Commerce warehouse schema

`orders` has one row per order. Its primary key is `order_id`; `customer_id` identifies the purchaser; `ordered_at` and `paid_at` are UTC timestamps; `shipping_region_code` is the region of the destination at checkout; and `order_currency` identifies the currency of order-level monetary fields. Test orders are identified by `is_test`. An order may remain in the table after cancellation for audit purposes.

`order_items` has one row per order line and joins to `orders` on `order_id`. Its primary key is `order_item_id`; `product_id` joins to `products`; `quantity` is signed so a reversal line can negate a replacement; and `net_item_amount` is in the major unit of `order_currency`. Product category is historical on the order item as `category_at_order`; joining the current product category may reclassify old sales.

`payments` has one row per payment attempt. It joins to orders on `order_id`, but only rows with `payment_status = 'captured'` represent collected cash. `amount_minor` is an integer in currency subunits. Multiple captures and partial refunds can exist for one order. `refunds` has one row per refund event, with `refund_amount` in major currency units and `refunded_at` in UTC.

`shipments` has one row per physical shipment, so an order can have several shipment rows. `warehouse_id` joins to `warehouses`, which supplies the facility timezone. Paid-to-shipped duration is computed from the order's first paid timestamp to each shipment's first carrier-accepted timestamp; canceled shipments are excluded.

`opportunities` has one row per sales opportunity. Its `owner_rep_id` joins to `sales_reps.rep_id`. Account attributes join through `account_id`. Region is descriptive and can contain several representatives, so region code is not an ownership key. Won opportunity amount is a bookings measure and does not join directly to commerce orders.
