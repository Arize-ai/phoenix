#!/usr/bin/env python3
"""Count blocked workspace writes"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query(
    "select count(*) from spans where status_message like '%writeFile is only allowed in /home/user/workspace%'"
)
write_answer(str(n))
