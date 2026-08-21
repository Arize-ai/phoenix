# Shipping operations and service targets

Standard delivery normally takes four to six business days after shipment; express normally takes one to two. The dated checkout estimate is the basis for a delivery review. A carrier trace becomes appropriate after two business days without movement following the first physical scan.

Response targets depend on impact. A delivered-but-missing parcel receives an initial case review within four business hours. A routine late shipment receives an initial review within one business day. A time-sensitive medication, safety concern, or widespread carrier event is escalated immediately. These are response targets, not guaranteed resolution times.

Cancellation requests are attempts until fulfillment confirms them. Once `status_lookup` reports in transit, the normal options are carrier intercept when available, refusal of delivery, or return after delivery. Updating the default account address changes future checkouts and does not reroute an existing parcel.

For order records and status records that disagree, compare their event timestamps. The most recent operational event controls the customer-facing status; the older value remains useful as history.
