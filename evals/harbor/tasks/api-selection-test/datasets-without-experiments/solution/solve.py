#!/usr/bin/env python3
"""Datasets with no experiments"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select d.name from datasets d
where not exists (select 1 from experiments x where x.dataset_id = d.id) order by d.id
""")
write_answer(f"{len(rows)}: " + "; ".join(r["name"] for r in rows))
