#!/usr/bin/env python3
"""Reasoning token usage and cost"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select count(distinct c.span_rowid) as n, round(sum(d.cost), 2) as cost
from span_cost_details d join span_costs c on c.id = d.span_cost_id
where d.token_type = 'reasoning' and d.tokens > 0
""")[0]
write_answer(f"{row['n']:,} calls, ${row['cost']:,.2f}")
