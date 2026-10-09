#!/usr/bin/env python3
"""Demo tool usage by project"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select json_extract(s.attributes, '$.tool.name') as tool, count(*) as n,
       group_concat(distinct p.name) as projects
from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
where json_extract(s.attributes, '$.tool.name') in ('weather', 'get_route_info', 'searchProducts')
group by tool order by n desc
""")
write_answer("; ".join(f"{r['tool']} {r['n']} in {r['projects']}" for r in rows))
