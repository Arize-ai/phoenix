#!/usr/bin/env python3
"""Most common opening tool in one project"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select tool, count(*) as n from (
  select json_extract(s.attributes, '$.tool.name') as tool,
         row_number() over (partition by t.id order by s.start_time) as rn
  from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
  where p.name = 'pxi_dev' and s.span_kind = 'TOOL'
) where rn = 1 group by tool order by n desc limit 3
""")
write_answer("; ".join(f"{r['tool']} {r['n']}" for r in rows))
