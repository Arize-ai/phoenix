#!/usr/bin/env python3
"""Count approval-gated failures by project"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select p.name, count(*) as n
from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
where s.status_message like 'ApprovalRequired%'
group by p.name order by n desc
""")
write_answer(
    f"{sum(r['n'] for r in rows)} spans: " + ", ".join(f"{r['name']} {r['n']}" for r in rows)
)
