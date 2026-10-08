#!/usr/bin/env python3
"""The longest span by duration"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select name, span_kind, round(latency_ms / 1000.0) as seconds
from spans order by latency_ms desc limit 1
""")[0]
write_answer(f"{row['name']} ({row['span_kind']}), about {row['seconds']:,.0f} seconds")
