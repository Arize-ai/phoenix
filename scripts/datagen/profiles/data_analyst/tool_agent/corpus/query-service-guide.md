# Query and lookup service guide

Schema guidance and governed metric definitions are available through document search. Record lookup returns one structured domain record for an exact identifier and is suitable for tracing a known order, customer, opportunity, or warehouse. Arithmetic expressions can be evaluated after the relevant values have been retrieved and their units verified.

Tabular query responses contain at most 500 rows. A complete response has `truncated: false`. When more rows match, the response has `truncated: true`, includes a continuation token, and reports the number of rows returned. Aggregations performed by the query service cover the full matched population unless the response explicitly identifies a sampled or partial computation.

Sorted top-N requests should be aggregated before applying the limit. Limiting raw rows and then aggregating can exclude categories or customers from consideration. When a result lacks completeness metadata, it cannot be assumed to represent all matching rows merely because it contains exactly 500 records.

Record identifiers are case-sensitive and should be passed unchanged. A missing record is distinct from a record containing null fields. Tool results may contain unusual values that are valid under documented business rules, so validation should use schema and data-quality guidance rather than broad plausibility checks.
