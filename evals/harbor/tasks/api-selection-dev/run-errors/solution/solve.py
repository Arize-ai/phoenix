#!/usr/bin/env python3
"""Experiments with failed runs"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select x.id, x.name, count(*) as runs, sum(case when r.error is not null then 1 else 0 end) as errors
from experiments x join experiment_runs r on r.experiment_id = x.id
group by x.id having errors > 0 order by x.id
""")
write_answer("; ".join(f"{r['name']} (id {r['id']}) {r['errors']} of {r['runs']}" for r in rows))
