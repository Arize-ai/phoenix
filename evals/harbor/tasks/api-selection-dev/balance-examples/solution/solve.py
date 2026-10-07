#!/usr/bin/env python3
"""Keyword search across dataset inputs"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select d.name, count(*) as n
from dataset_example_revisions r join dataset_examples e on e.id = r.dataset_example_id
join datasets d on d.id = e.dataset_id
where r.id in (select max(id) from dataset_example_revisions group by dataset_example_id)
and r.revision_kind <> 'DELETE' and lower(r.input) like '%balance%'
group by d.name order by d.name
""")
write_answer(f"{sum(r['n'] for r in rows)}: " + ", ".join(f"{r['name']} {r['n']}" for r in rows))
