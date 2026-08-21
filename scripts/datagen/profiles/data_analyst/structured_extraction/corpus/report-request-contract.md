# Report request contract

A report request records the business question separately from implementation details. Every request has a report purpose, a bounded date range, a time grain, one or more metrics, zero or more dimensions, filters, a timezone, an output format, and a delivery cadence. A field may be marked unresolved when the requester has not supplied enough information; it should not be silently inferred from a similarly named field.

Date ranges use inclusive start dates and exclusive end dates. Relative phrases such as “last month” mean the last completed calendar month in the requested timezone. “Quarter to date” begins at local midnight on the first day of the fiscal quarter and ends at the report run time. If no timezone is given, the request remains unresolved because UTC, company reporting time, and warehouse-local time can produce different daily totals.

Metrics identify governed definitions by canonical name. Dimensions determine the result grain; filters restrict the population without adding columns to the result. Comparisons record both the comparison period and whether the request is for absolute change, percentage change, or both. Row-level exports must list required identifiers and fields rather than using “all columns.”

Supported output formats are dashboard, chart, table, CSV export, spreadsheet, and presentation summary. Urgency describes the delivery deadline, not the importance of the metric. A complete request can still include explicit open questions when the user must choose a definition, timezone, or grain.
