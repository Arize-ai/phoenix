#!/usr/bin/env python3
"""Peak day for span annotations"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql(
    "select date(created_at) as day, count(*) as n from span_annotations group by day order by n desc limit 1"
)[0]
write_answer(f"{row['day']}, {row['n']}")
