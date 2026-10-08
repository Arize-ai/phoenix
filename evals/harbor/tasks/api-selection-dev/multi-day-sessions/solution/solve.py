#!/usr/bin/env python3
"""Count sessions spanning midnight"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

write_answer(
    str(get_scalar_from_sql_query("select count(*) from project_sessions where date(start_time) <> date(end_time)"))
)
