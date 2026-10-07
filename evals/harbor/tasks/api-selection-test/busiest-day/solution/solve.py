#!/usr/bin/env python3
"""Peak day of span volume"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql(
    "select date(start_time) as day, count(*) as n from spans group by day order by n desc limit 1"
)[0]
write_answer(f"{row['day']}, {row['n']:,} spans")
