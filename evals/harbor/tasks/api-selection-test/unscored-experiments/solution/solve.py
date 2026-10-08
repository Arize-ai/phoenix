#!/usr/bin/env python3
"""Experiments that were never evaluated"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select x.id, x.name from experiments x
where exists (select 1 from experiment_runs r where r.experiment_id = x.id)
and not exists (
  select 1 from experiment_runs r join experiment_run_annotations a on a.experiment_run_id = r.id
  where r.experiment_id = x.id
) order by x.id
""")
write_answer("; ".join(f"{r['name']} (id {r['id']})" for r in rows))
