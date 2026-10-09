#!/usr/bin/env python3
"""Deleted examples by dataset"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select d.name, count(*) as n
from dataset_example_revisions r join dataset_examples e on e.id = r.dataset_example_id
join datasets d on d.id = e.dataset_id
where r.revision_kind = 'DELETE' group by d.name
""")
write_answer("; ".join(f"{r['n']} from {r['name']}" for r in rows))
