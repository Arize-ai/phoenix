#!/usr/bin/env python3
"""Count long sessions in one project"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(*) from (
  select t.project_session_rowid, count(*) as c
  from traces t join projects p on p.id = t.project_rowid
  where p.name = 'pxi_agent_tony' and t.project_session_rowid is not null
  group by t.project_session_rowid having c > 20
)
""")
write_answer(str(n))
