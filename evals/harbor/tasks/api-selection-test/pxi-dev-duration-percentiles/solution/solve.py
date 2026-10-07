#!/usr/bin/env python3
"""Median and p95 trace duration for one project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select round(median(t.latency_ms) / 1000.0, 1) as p50,
       round(percentile(t.latency_ms, 95) / 1000.0, 1) as p95
from traces t join projects p on p.id = t.project_rowid
where p.name = 'pxi_dev'
""")[0]
write_answer(f"median {row['p50']} s, p95 {row['p95']} s")
