#!/usr/bin/env python3
"""Root span status counts for one project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select s.status_code, count(*) as n
from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
where p.name = 'pxi_dev' and s.parent_id is null
group by s.status_code order by n desc
""")
write_answer("; ".join(f"{r['status_code']} {r['n']:,}" for r in rows))
