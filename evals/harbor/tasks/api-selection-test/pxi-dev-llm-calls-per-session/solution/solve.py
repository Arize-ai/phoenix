#!/usr/bin/env python3
"""Average LLM calls per session in one project"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select round(avg(c), 2) from (
  select t.project_session_rowid, count(*) as c
  from spans s join traces t on t.id = s.trace_rowid join projects p on p.id = t.project_rowid
  where p.name = 'pxi_dev' and s.span_kind = 'LLM' and t.project_session_rowid is not null
  group by t.project_session_rowid
)
""")
write_answer(f"{n} LLM calls per session")
