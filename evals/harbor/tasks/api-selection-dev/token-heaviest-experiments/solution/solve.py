#!/usr/bin/env python3
"""Experiments by prompt token usage"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select x.id, x.name, sum(r.prompt_token_count) as prompt_tokens
from experiment_runs r join experiments x on x.id = r.experiment_id
group by x.id order by prompt_tokens desc, x.id limit 3
""")
write_answer("; ".join(f"{r['name']} (id {r['id']}) {r['prompt_tokens']:,}" for r in rows))
