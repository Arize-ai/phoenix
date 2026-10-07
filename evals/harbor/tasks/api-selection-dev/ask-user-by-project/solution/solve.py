#!/usr/bin/env python3
"""Clarifying questions per project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select p.name, count(*) as n
from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
where json_extract(s.attributes, '$.tool.name') in ('ask_user', 'AskUserQuestion')
group by p.name order by n desc, p.name
""")
write_answer("; ".join(f"{r['name']} {r['n']}" for r in rows))
