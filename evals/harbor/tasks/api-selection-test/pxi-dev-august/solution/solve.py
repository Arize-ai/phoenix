#!/usr/bin/env python3
"""Monthly trace count and idle days for one project"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select count(*) as n, count(distinct date(t.start_time)) as active_days
from traces t join projects p on p.id = t.project_rowid
where p.name = 'pxi_dev' and t.start_time >= '2026-08-01' and t.start_time < '2026-09-01'
""")[0]
write_answer(f"{row['n']} traces; {31 - row['active_days']} days with none")
