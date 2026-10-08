#!/usr/bin/env python3
"""Top tools by call count"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select json_extract(attributes, '$.tool.name') as tool, count(*) as n
from spans where span_kind = 'TOOL'
group by tool order by n desc limit 3
""")
write_answer("; ".join(f"{r['tool']} {r['n']:,}" for r in rows))
