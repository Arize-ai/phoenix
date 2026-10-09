#!/usr/bin/env python3
"""Span annotation coverage for one project"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select count(distinct case when a.id is not null then t.id end) as annotated, count(distinct t.id) as total
from traces t join projects p on p.id = t.project_rowid
left join spans s on s.trace_rowid = t.id
left join span_annotations a on a.span_rowid = s.id
where p.name = 'pxi_dev'
""")[0]
write_answer(
    f"{row['annotated']} of {row['total']}, {100.0 * row['annotated'] / row['total']:.1f}%"
)
