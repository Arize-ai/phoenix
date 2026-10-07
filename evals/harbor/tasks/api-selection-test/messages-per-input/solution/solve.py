#!/usr/bin/env python3
"""Dataset with the longest conversational inputs"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select d.name, round(avg(m.n), 2) as messages from (
  select r.dataset_example_id, count(*) as n
  from dataset_example_revisions r, json_each(r.input, '$.messages')
  where r.id in (select max(id) from dataset_example_revisions group by dataset_example_id)
  group by r.id
) m join dataset_examples e on e.id = m.dataset_example_id join datasets d on d.id = e.dataset_id
group by d.name order by messages desc limit 1
""")
write_answer(f"{rows[0]['name']}, {rows[0]['messages']} messages on average")
