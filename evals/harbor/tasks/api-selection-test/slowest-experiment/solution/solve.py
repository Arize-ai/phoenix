#!/usr/bin/env python3
"""Experiment with the slowest runs"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select x.id, x.name, round(avg(r.latency_ms) / 1000.0, 1) as seconds
from experiment_runs r join experiments x on x.id = r.experiment_id
group by x.id order by seconds desc limit 1
""")[0]
write_answer(f"{row['name']} (id {row['id']}), {row['seconds']} s per run")
