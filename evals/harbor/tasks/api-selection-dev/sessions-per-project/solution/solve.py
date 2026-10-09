#!/usr/bin/env python3
"""Session counts and traces per session"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select p.name, count(distinct ps.id) as sessions, round(1.0 * count(t.id) / count(distinct ps.id), 2) as per_session
from project_sessions ps join projects p on p.id = ps.project_id
join traces t on t.project_session_rowid = ps.id
group by p.name order by sessions desc limit 4
""")
write_answer(
    "; ".join(f"{r['name']} {r['sessions']} sessions, {r['per_session']} traces each" for r in rows)
)
