#!/usr/bin/env python3
"""Median session duration per project"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select p.name, round(median((julianday(ps.end_time) - julianday(ps.start_time)) * 1440), 1) as minutes
from project_sessions ps join projects p on p.id = ps.project_id
group by p.name having count(*) >= 20 order by minutes desc
""")
write_answer("; ".join(f"{r['name']} {r['minutes']} min" for r in rows))
