#!/usr/bin/env python3
"""Per-example score changes between two experiments"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select r3.dataset_example_id as example, a3.score as before, a4.score as after
from experiments x3 join experiment_runs r3 on r3.experiment_id = x3.id
join experiment_run_annotations a3 on a3.experiment_run_id = r3.id and a3.name = 'safe_sql_exact_match'
join experiments x4 on x4.name = 'safe-sql prompt v4 disambiguation'
join experiment_runs r4 on r4.experiment_id = x4.id and r4.dataset_example_id = r3.dataset_example_id
join experiment_run_annotations a4 on a4.experiment_run_id = r4.id and a4.name = 'safe_sql_exact_match'
where x3.name = 'safe-sql prompt v3 authorization fix' and a3.score <> a4.score
order by example
""")
improved = [r for r in rows if r["after"] > r["before"]]
regressed = [r for r in rows if r["after"] < r["before"]]
fmt = lambda r: f"example {r['example']} {r['before']:g} -> {r['after']:g}"  # noqa: E731
write_answer(
    f"improved: {'; '.join(map(fmt, improved)) or 'none'}. "
    f"regressed: {'; '.join(map(fmt, regressed)) or 'none'}."
)
