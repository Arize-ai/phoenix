#!/usr/bin/env python3
"""Count traces that spawn subagents"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query(
    "select count(distinct trace_rowid) from spans where json_extract(attributes, '$.tool.name') = 'call_subagent'"
)
write_answer(str(n))
