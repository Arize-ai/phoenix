#!/usr/bin/env python3
"""Largest average prompt per model"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select json_extract(attributes, '$.llm.model_name') as model,
       round(avg(llm_token_count_prompt)) as avg_prompt, count(*) as n
from spans where span_kind = 'LLM' and llm_token_count_prompt is not null
group by model having count(*) >= 100 order by avg_prompt desc limit 3
""")
write_answer("; ".join(f"{r['model']} {r['avg_prompt']:,.0f} tokens per call" for r in rows))
