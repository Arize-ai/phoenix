#!/usr/bin/env python3
"""Count single-trace sessions"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select count(*) from (
  select project_session_rowid, count(*) as c from traces
  where project_session_rowid is not null group by project_session_rowid having c = 1
)
""")
write_answer(str(n))
