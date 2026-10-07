#!/usr/bin/env python3
"""Control: LLM spans missing costs"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(*) from spans s
where s.span_kind = 'LLM' and coalesce(s.llm_token_count_prompt, 0) + coalesce(s.llm_token_count_completion, 0) > 0
and not exists (select 1 from span_costs c where c.span_rowid = s.id)
""")
write_answer(str(n))
