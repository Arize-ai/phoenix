#!/usr/bin/env python3
"""Top three error message prefixes by span count"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select substr(status_message, 1, 40) as prefix, count(*) as n
from spans where status_code = 'ERROR'
group by prefix order by n desc limit 3
""")
write_answer("; ".join(f"{r['prefix']!r} {r['n']}" for r in rows))
