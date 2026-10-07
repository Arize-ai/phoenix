#!/usr/bin/env python3
"""Score progression across a prompt iteration series"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select x.name, round(avg(a.score), 3) as mean, count(*) as runs
from experiments x join datasets d on d.id = x.dataset_id
join experiment_runs r on r.experiment_id = x.id
join experiment_run_annotations a on a.experiment_run_id = r.id and a.name = 'safe_sql_exact_match'
where d.name = 'banking_saas_dataset_clean'
group by x.id order by x.created_at
""")
write_answer("; ".join(f"{r['name']} {r['mean']} ({r['runs']} runs)" for r in rows))
