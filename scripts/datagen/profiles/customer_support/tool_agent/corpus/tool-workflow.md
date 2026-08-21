# Customer support tool workflow

Use the order identifier as the primary key for account work. `record_lookup` returns the order's customer label, total, and currency. A name is useful context but is not a unique record key. When two customers have the same display name, the order identifier and delivery postal code distinguish their purchases.

`status_lookup` returns the operational state for an order. A newer status result takes precedence over a stale summary embedded in the original order record. “Processing” means fulfillment has not handed the parcel to the carrier. “In transit” means cancellation is no longer guaranteed; the customer may refuse delivery or begin a return after delivery.

`document_search` retrieves policy and workflow passages. Search results can include archived material, so the document title, effective date, and replacement notice matter. `safe_arithmetic` is appropriate for transparent comparisons of order totals, line-item amounts, and expected refunds. `ticket_creation` records unresolved work but does not itself issue money, cancel a shipment, reserve inventory, or change an order. Ticket descriptions should preserve the verified identifier, observed facts, and requested follow-up.
