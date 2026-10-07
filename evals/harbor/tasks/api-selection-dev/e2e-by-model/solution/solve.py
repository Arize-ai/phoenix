#!/usr/bin/env python3
"""Pass rate by assistant model"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select json_extract(x.metadata, '$.assistantModel') as model, round(avg(a.score), 3) as rate, count(*) as runs
from experiments x join experiment_runs r on r.experiment_id = x.id
join experiment_run_annotations a on a.experiment_run_id = r.id and a.name = 'pxi_outcome'
group by model order by rate
""")
write_answer("; ".join(f"{r['model']} {r['rate']} over {r['runs']} runs" for r in rows))
