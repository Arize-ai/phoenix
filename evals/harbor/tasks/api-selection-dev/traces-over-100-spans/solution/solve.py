#!/usr/bin/env python3
"""Count large traces and name the largest"""

from harbor_verifiers.phoenix_api import execute_sql, scalar, write_answer

n = scalar(
    "select count(*) from (select trace_rowid, count(*) as c from spans group by trace_rowid) where c > 100"
)
top = execute_sql("""
select t.trace_id, count(*) as c from spans s join traces t on t.id = s.trace_rowid
group by t.trace_id order by c desc limit 1
""")[0]
write_answer(f"{n} traces; the largest is {top['trace_id']} with {top['c']} spans")
