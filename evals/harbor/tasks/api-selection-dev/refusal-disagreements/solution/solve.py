#!/usr/bin/env python3
"""Disagreement between two evaluators"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select a.label as original, b.label as fixed, count(*) as n
from experiment_run_annotations a join experiment_run_annotations b on b.experiment_run_id = a.experiment_run_id
where a.name = 'refusal_detection' and b.name = 'refusal_detection_fixed' and a.score <> b.score
group by a.label, b.label order by n desc
""")
total = sum(r["n"] for r in rows)
write_answer(
    f"{total} disagreements: "
    + "; ".join(
        f"{r['n']} where refusal_detection says {r['original']} and refusal_detection_fixed says {r['fixed']}"
        for r in rows
    )
)
