#!/usr/bin/env python3
"""Evaluator runs by sandbox backend"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select json_extract(attributes, '$.metadata.backend_type') as backend, count(*) as n
from spans where json_extract(attributes, '$.metadata.backend_type') is not null
group by backend order by n desc
""")
write_answer("; ".join(f"{r['backend']} {r['n']:,}" for r in rows))
