#!/usr/bin/env python3
"""Top three sessions by spend in one project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select ps.session_id, round(sum(sc.total_cost), 2) as cost
from span_costs sc join traces t on t.id = sc.trace_rowid
join project_sessions ps on ps.id = t.project_session_rowid
join projects p on p.id = t.project_rowid
where p.name = 'pxi_dev'
group by ps.session_id order by cost desc limit 3
""")
write_answer("; ".join(f"{r['session_id']} ${r['cost']:,.2f}" for r in rows))
