#!/usr/bin/env python3
"""Span kinds behind one annotation label"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select s.span_kind, count(*) as n from span_annotations a join spans s on s.id = a.span_rowid
where a.name = 'issue' and a.label = 'major' group by s.span_kind order by s.span_kind
""")
write_answer("; ".join(f"{r['span_kind']} {r['n']}" for r in rows))
