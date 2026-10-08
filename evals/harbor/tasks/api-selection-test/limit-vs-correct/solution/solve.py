#!/usr/bin/env python3
"""Cross-tabulate two evaluators"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select sum(case when a.score = 1 and b.score = 0 then 1 else 0 end) as limit_only,
       sum(case when a.score = 0 and b.score = 1 then 1 else 0 end) as correct_only
from experiment_run_annotations a join experiment_run_annotations b on b.experiment_run_id = a.experiment_run_id
where a.name = 'tool_call_count_within_limit' and b.name = 'correct_tools_called'
""")[0]
write_answer(
    f"{row['limit_only']} pass the limit but fail correct tools; {row['correct_only']} the reverse"
)
