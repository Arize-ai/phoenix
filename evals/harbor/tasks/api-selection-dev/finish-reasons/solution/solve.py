#!/usr/bin/env python3
"""Finish reason distribution"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select json_extract(attributes, '$.llm.finish_reason') as reason, count(*) as n
from spans where json_extract(attributes, '$.llm.finish_reason') is not null
group by reason order by n desc
""")
write_answer("; ".join(f"{r['reason']} {r['n']:,}" for r in rows))
