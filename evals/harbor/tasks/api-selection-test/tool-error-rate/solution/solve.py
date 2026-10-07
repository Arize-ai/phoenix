#!/usr/bin/env python3
"""Tool with the highest error rate"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select json_extract(attributes, '$.tool.name') as tool, count(*) as n,
       sum(case when status_code = 'ERROR' then 1 else 0 end) as errors
from spans where span_kind = 'TOOL'
group by tool having count(*) >= 100
order by 1.0 * sum(case when status_code = 'ERROR' then 1 else 0 end) / count(*) desc limit 2
""")
top, runner = rows
write_answer(
    f"{top['tool']}: {top['errors']} of {top['n']} calls ({100.0 * top['errors'] / top['n']:.1f}%); "
    f"next is {runner['tool']} at {100.0 * runner['errors'] / runner['n']:.1f}%"
)
