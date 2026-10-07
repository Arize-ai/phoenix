#!/usr/bin/env python3
"""Share of traces with an ERROR span in one project"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select count(distinct case when s.status_code = 'ERROR' then t.id end) as errored,
       count(distinct t.id) as total
from traces t join projects p on p.id = t.project_rowid
join spans s on s.trace_rowid = t.id
where p.name = 'pxi_dev'
""")[0]
write_answer(
    f"{row['errored']} of {row['total']} traces, {100.0 * row['errored'] / row['total']:.1f}%"
)
