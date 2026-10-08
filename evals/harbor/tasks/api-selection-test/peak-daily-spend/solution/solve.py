#!/usr/bin/env python3
"""Most expensive project-day"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select p.name, date(sc.span_start_time) as day, round(sum(sc.total_cost), 2) as cost
from span_costs sc join traces t on t.id = sc.trace_rowid join projects p on p.id = t.project_rowid
group by p.name, day order by cost desc limit 1
""")[0]
write_answer(f"{row['name']} on {row['day']}, ${row['cost']:,.2f}")
