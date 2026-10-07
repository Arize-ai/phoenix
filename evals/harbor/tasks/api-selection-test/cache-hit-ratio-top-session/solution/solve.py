#!/usr/bin/env python3
"""Session with the best prompt cache hit ratio"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

row = execute_sql("""
select ps.session_id,
       round(1.0 * sum(json_extract(s.attributes, '$.llm.token_count.prompt_details.cache_read'))
             / sum(s.llm_token_count_prompt), 3) as ratio
from spans s join traces t on t.id = s.trace_rowid
join project_sessions ps on ps.id = t.project_session_rowid
join projects p on p.id = t.project_rowid
where p.name = 'pxi_dev' and s.span_kind = 'LLM'
group by ps.session_id having sum(s.llm_token_count_prompt) > 0
order by ratio desc limit 1
""")[0]
write_answer(f"{row['session_id']} at {100.0 * row['ratio']:.1f}%")
