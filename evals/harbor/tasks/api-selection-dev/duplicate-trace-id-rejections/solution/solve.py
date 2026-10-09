#!/usr/bin/env python3
"""Count duplicate trace id rejections"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query(
    "select count(*) from spans where status_message like '%UNIQUE constraint failed: traces.trace_id%'"
)
write_answer(str(n))
