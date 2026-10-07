#!/usr/bin/env python3
"""Most and least exercised examples in one dataset"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select r.dataset_example_id as example, count(*) as n
from experiment_runs r join experiments x on x.id = r.experiment_id
join datasets d on d.id = x.dataset_id
where d.name = 'PXI E2E Agent Tests'
group by example order by n desc
""")
write_answer(
    f"example {rows[0]['example']} with {rows[0]['n']} runs; example {rows[-1]['example']} with {rows[-1]['n']} run"
)
