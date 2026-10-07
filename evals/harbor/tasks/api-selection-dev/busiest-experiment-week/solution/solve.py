#!/usr/bin/env python3
"""Peak week of experiment creation"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select strftime('%Y-%W', x.created_at) as week, min(date(x.created_at)) as first_day, d.name, count(*) as n
from experiments x join datasets d on d.id = x.dataset_id
group by week, d.name order by n desc limit 1
""")[0]
write_answer(
    f"the week starting {row['first_day']} (ISO week {row['week']}), {row['name']}, {row['n']} experiments"
)
