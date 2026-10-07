#!/usr/bin/env python3
"""Highest cost per trace by project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select p.name, round(sum(sc.total_cost) / count(distinct t.id), 3) as per_trace
from traces t join projects p on p.id = t.project_rowid
join span_costs sc on sc.trace_rowid = t.id
where p.name not like 'Experiment-%'
group by p.name order by per_trace desc limit 3
""")
write_answer("; ".join(f"{r['name']} ${r['per_trace']:.3f}" for r in rows))
