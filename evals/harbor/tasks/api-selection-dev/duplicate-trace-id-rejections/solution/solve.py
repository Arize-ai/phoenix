#!/usr/bin/env python3
"""Count duplicate trace id rejections"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar(
    "select count(*) from spans where status_message like '%UNIQUE constraint failed: traces.trace_id%'"
)
write_answer(str(n))
