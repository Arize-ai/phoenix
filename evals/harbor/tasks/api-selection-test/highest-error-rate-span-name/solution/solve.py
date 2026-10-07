#!/usr/bin/env python3
"""Span name with the highest error rate"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select name, count(*) as n, sum(case when status_code = 'ERROR' then 1 else 0 end) as errors
from spans group by name having count(*) >= 50
order by 1.0 * sum(case when status_code = 'ERROR' then 1 else 0 end) / count(*) desc limit 2
""")
top, runner = rows
write_answer(
    f"{top['name']}: {top['errors']} of {top['n']} spans ({100.0 * top['errors'] / top['n']:.1f}%); "
    f"runner-up {runner['name']} at {100.0 * runner['errors'] / runner['n']:.1f}%"
)
