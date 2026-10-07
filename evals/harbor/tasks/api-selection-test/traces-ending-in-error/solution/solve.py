#!/usr/bin/env python3
"""Traces whose final span errored"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(*) from (
  select trace_rowid, status_code,
         row_number() over (partition by trace_rowid order by start_time desc) as rn
  from spans
) where rn = 1 and status_code = 'ERROR'
""")
write_answer(str(n))
