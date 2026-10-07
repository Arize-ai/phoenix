#!/usr/bin/env python3
"""Evaluator execution time extremes"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select substr(name, 12) as evaluator, round(percentile(latency_ms, 95) / 1000.0, 2) as p95
from spans where span_kind = 'EVALUATOR' and name like 'Evaluator: %'
group by evaluator order by p95 desc
""")
write_answer(
    f"slowest {rows[0]['evaluator']} at {rows[0]['p95']} s; fastest {rows[-1]['evaluator']} at {rows[-1]['p95']} s"
)
