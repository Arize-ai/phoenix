#!/usr/bin/env python3
"""Count traces that spawn subagents"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar(
    "select count(distinct trace_rowid) from spans where json_extract(attributes, '$.tool.name') = 'call_subagent'"
)
write_answer(str(n))
