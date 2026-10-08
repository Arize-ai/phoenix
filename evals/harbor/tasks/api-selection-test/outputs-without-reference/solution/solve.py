#!/usr/bin/env python3
"""Dataset with the most unreferenced outputs"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

row = execute_sql_query("""
select d.name, count(*) as n
from dataset_example_revisions r join dataset_examples e on e.id = r.dataset_example_id
join datasets d on d.id = e.dataset_id
where r.id in (select max(id) from dataset_example_revisions group by dataset_example_id)
and r.revision_kind <> 'DELETE'
and json_extract(r.output, '$.reference') is null and json_extract(r.output, '$.expected') is null
group by d.name order by n desc limit 1
""")[0]
write_answer(f"{row['name']}, {row['n']} examples")
