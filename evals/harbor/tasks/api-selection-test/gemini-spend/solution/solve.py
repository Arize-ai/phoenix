#!/usr/bin/env python3
"""Total Gemini spend and where it occurred"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select round(sum(sc.total_cost), 2) as cost, group_concat(distinct p.name) as projects
from span_costs sc join generative_models gm on gm.id = sc.model_id
join traces t on t.id = sc.trace_rowid join projects p on p.id = t.project_rowid
where gm.name like 'gemini%'
""")[0]
write_answer(f"${row['cost']:,.2f}, all in {row['projects']}")
