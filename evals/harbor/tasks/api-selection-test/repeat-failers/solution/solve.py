#!/usr/bin/env python3
"""Examples that fail repeatedly across experiments"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select r.dataset_example_id as example, sum(case when a.score = 0 then 1 else 0 end) as failures
from experiments x join experiment_runs r on r.experiment_id = x.id
join experiment_run_annotations a on a.experiment_run_id = r.id and a.name = 'safe_sql_exact_match'
where x.name in ('safe-sql prompt v1 rerun', 'safe-sql prompt v2 canonical',
                 'safe-sql prompt v3 authorization fix', 'safe-sql prompt v4 disambiguation')
group by example having failures > 1 order by failures desc, example
""")
write_answer("; ".join(f"example {r['example']} failed {r['failures']} times" for r in rows))
