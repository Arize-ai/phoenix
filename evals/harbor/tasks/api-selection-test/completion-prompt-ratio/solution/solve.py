#!/usr/bin/env python3
"""Most completion-heavy model"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select gm.name, round(sum(sc.completion_tokens) / sum(sc.prompt_tokens), 4) as ratio
from span_costs sc join generative_models gm on gm.id = sc.model_id
group by gm.name having sum(sc.prompt_tokens) > 1000000
order by ratio desc limit 2
""")
write_answer(
    f"{rows[0]['name']} at {rows[0]['ratio']}; next is {rows[1]['name']} at {rows[1]['ratio']}"
)
