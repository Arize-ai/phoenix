#!/usr/bin/env python3
"""Projects with the most distinct tools"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select p.name, count(distinct json_extract(s.attributes, '$.tool.name')) as n
from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
where s.span_kind = 'TOOL'
group by p.name order by n desc limit 2
""")
write_answer("; ".join(f"{r['name']} {r['n']}" for r in rows))
