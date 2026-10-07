#!/usr/bin/env python3
"""Count examples above a token threshold"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select sum(case when json_extract(r.output, '$.token_count_total') > 25000 then 1 else 0 end) as over, count(*) as total
from dataset_example_revisions r join dataset_examples e on e.id = r.dataset_example_id
join datasets d on d.id = e.dataset_id
where d.name = 'High Token Count Spans (>20k)'
and r.id in (select max(id) from dataset_example_revisions group by dataset_example_id)
""")[0]
write_answer(f"{row['over']} of {row['total']}")
