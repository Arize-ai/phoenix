#!/usr/bin/env python3
"""Average tool calls per trace by project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select p.name, round(1.0 * sum(case when s.span_kind = 'TOOL' then 1 else 0 end) / count(distinct t.id), 2) as per_trace
from traces t join projects p on p.id = t.project_rowid join spans s on s.trace_rowid = t.id
where p.name in ('pxi_agent_tony', 'pxi_dev')
group by p.name order by per_trace desc
""")
write_answer("; ".join(f"{r['name']} {r['per_trace']}" for r in rows))
