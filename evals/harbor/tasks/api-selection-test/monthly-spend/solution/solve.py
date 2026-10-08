#!/usr/bin/env python3
"""One month's share of total spend"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select round(sum(case when span_start_time >= '2026-08-01' and span_start_time < '2026-09-01'
                      then total_cost else 0 end), 2) as august,
       round(sum(total_cost), 2) as total
from span_costs
""")[0]
write_answer(
    f"${row['august']:,.2f} of ${row['total']:,.2f}, {100.0 * row['august'] / row['total']:.1f}%"
)
