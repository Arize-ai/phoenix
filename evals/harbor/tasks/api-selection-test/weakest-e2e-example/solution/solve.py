#!/usr/bin/env python3
"""Lowest-scoring example in one dataset"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select r.dataset_example_id as example, round(avg(a.score), 3) as rate,
       sum(case when a.score = 1 then 1 else 0 end) as passed, count(*) as runs
from experiment_runs r join experiment_run_annotations a on a.experiment_run_id = r.id and a.name = 'pxi_outcome'
group by example order by rate limit 1
""")[0]
write_answer(f"example {row['example']}: {row['passed']} of {row['runs']} passed, {row['rate']}")
