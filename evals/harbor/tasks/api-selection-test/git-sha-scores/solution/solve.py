#!/usr/bin/env python3
"""Weakest commit by evaluator score"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select json_extract(x.metadata, '$.git_sha') as sha, round(avg(a.score), 3) as rate, count(*) as runs
from experiments x join experiment_runs r on r.experiment_id = x.id
join experiment_run_annotations a on a.experiment_run_id = r.id and a.name = 'correct_tools_called'
where json_extract(x.metadata, '$.git_sha') is not null
group by sha order by rate limit 1
""")
r = rows[0]
write_answer(f"{r['sha']} at {r['rate']} over {r['runs']} runs")
