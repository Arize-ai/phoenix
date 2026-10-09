#!/usr/bin/env python3
"""Name the three largest projects by trace count"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select p.name, count(*) as n
from traces t join projects p on p.id = t.project_rowid
where p.name not like 'Experiment-%'
group by p.name order by n desc limit 3
""")
write_answer("; ".join(f"{r['name']} {r['n']:,}" for r in rows))
