#!/usr/bin/env python3
"""Datasets ranked by experiment count"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select d.name,
       (select count(*) from experiments x where x.dataset_id = d.id) as experiments,
       (select count(*) from dataset_examples e where e.dataset_id = d.id) as examples,
       (select count(*) from dataset_versions v where v.dataset_id = d.id) as versions
from datasets d order by experiments desc, d.id limit 5
""")
write_answer(
    "; ".join(
        f"{r['name']}: {r['experiments']} experiments, {r['examples']} examples, {r['versions']} versions"
        for r in rows
    )
)
