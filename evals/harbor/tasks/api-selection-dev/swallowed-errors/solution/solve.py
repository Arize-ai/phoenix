#!/usr/bin/env python3
"""Traces whose errors are not reflected on the root span"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select count(distinct r.trace_rowid)
from spans r join spans c on c.trace_rowid = r.trace_rowid and c.id <> r.id
where r.parent_id is null and r.status_code = 'OK' and c.status_code = 'ERROR'
""")
write_answer(str(n))
