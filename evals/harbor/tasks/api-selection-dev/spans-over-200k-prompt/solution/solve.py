#!/usr/bin/env python3
"""Count very large prompts"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

write_answer(
    str(
        get_scalar_from_sql_query(
            "select count(*) from spans where llm_token_count_prompt > 200000"
        )
    )
)
