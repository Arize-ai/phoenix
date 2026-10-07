#!/usr/bin/env python3
"""Failed examples in one experiment"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select r.dataset_example_id as example, a.score
from experiments x join experiment_runs r on r.experiment_id = x.id
join experiment_run_annotations a on a.experiment_run_id = r.id and a.name = 'first_tool_matches_expected'
where x.name = 'Luna first-tool routing — validated evaluator' order by example
""")
failed = [r["example"] for r in rows if r["score"] == 0]
write_answer(
    f"examples {', '.join(map(str, failed))} failed; {len(rows) - len(failed)} of {len(rows)} passed"
)
