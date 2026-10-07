#!/usr/bin/env python3
"""Count very large prompts"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(str(scalar("select count(*) from spans where llm_token_count_prompt > 200000")))
