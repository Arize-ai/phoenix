#!/usr/bin/env python3
"""Most reused dataset version"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select x.dataset_version_id as version, d.name, count(*) as n
from experiments x join datasets d on d.id = x.dataset_id
group by version order by n desc limit 1
""")[0]
write_answer(f"version {row['version']} of {row['name']}, {row['n']} experiments")
