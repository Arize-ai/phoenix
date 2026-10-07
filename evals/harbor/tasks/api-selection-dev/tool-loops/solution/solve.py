#!/usr/bin/env python3
"""Count traces with repeated tool calls"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(distinct trace_rowid) from (
  select trace_rowid, json_extract(attributes, '$.tool.name') as tool, count(*) as c
  from spans where span_kind = 'TOOL' group by trace_rowid, tool having c > 10
)
""")
write_answer(str(n))
