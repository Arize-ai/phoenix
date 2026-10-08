#!/usr/bin/env python3
"""Evaluator span errors"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select substr(name, 12) as evaluator, count(*) as n
from spans where span_kind = 'EVALUATOR' and status_code = 'ERROR'
group by evaluator order by n desc
""")
write_answer("; ".join(f"{r['evaluator']} {r['n']}" for r in rows))
