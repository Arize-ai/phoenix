#!/usr/bin/env python3
"""Control: duplicated examples across datasets"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select count(*) from (
  select r.content_hash from dataset_example_revisions r join dataset_examples e on e.id = r.dataset_example_id
  where r.content_hash is not null group by r.content_hash having count(distinct e.dataset_id) > 1
)
""")
write_answer(str(n))
