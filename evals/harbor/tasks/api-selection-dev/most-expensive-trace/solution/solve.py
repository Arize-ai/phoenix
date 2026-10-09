#!/usr/bin/env python3
"""The most expensive trace"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select t.trace_id, round(sum(sc.total_cost), 2) as cost
from span_costs sc join traces t on t.id = sc.trace_rowid
group by t.trace_id order by cost desc limit 1
""")[0]
write_answer(f"{row['trace_id']}, ${row['cost']:,.2f}")
