#!/usr/bin/env python3
"""Traces whose final span errored"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select count(*) from (
  select trace_rowid, status_code,
         row_number() over (partition by trace_rowid order by start_time desc) as rn
  from spans
) where rn = 1 and status_code = 'ERROR'
""")
write_answer(str(n))
