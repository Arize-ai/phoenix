#!/usr/bin/env python3
"""Searches that never loaded a skill"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select count(distinct a.trace_rowid) from spans a
where json_extract(a.attributes, '$.tool.name') = 'search_phoenix'
and not exists (
  select 1 from spans b where b.trace_rowid = a.trace_rowid
  and json_extract(b.attributes, '$.tool.name') = 'load_skill' and b.start_time > a.start_time
)
""")
write_answer(str(n))
