#!/usr/bin/env python3
"""Peak hour of trace volume"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select strftime('%H', start_time) as hour, count(*) as n
from traces group by hour order by n desc limit 1
""")[0]
write_answer(f"{row['hour']}:00 UTC, {row['n']:,} traces")
