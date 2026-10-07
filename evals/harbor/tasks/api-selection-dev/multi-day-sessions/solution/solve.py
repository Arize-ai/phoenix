#!/usr/bin/env python3
"""Count sessions spanning midnight"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(
    str(scalar("select count(*) from project_sessions where date(start_time) <> date(end_time)"))
)
