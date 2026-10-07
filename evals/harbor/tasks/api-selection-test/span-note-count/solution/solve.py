#!/usr/bin/env python3
"""Count notes and find the newest"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql(
    "select count(*) as n, max(date(created_at)) as newest from span_annotations where name = 'note'"
)[0]
write_answer(f"{row['n']} notes; newest on {row['newest']}")
