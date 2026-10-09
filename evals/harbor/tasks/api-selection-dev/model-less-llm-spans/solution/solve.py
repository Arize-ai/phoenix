#!/usr/bin/env python3
"""Count LLM spans missing a model name"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query(
    "select count(*) from spans where span_kind = 'LLM' and json_extract(attributes, '$.llm.model_name') is null"
)
write_answer(str(n))
