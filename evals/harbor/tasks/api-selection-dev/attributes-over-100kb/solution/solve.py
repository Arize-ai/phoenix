#!/usr/bin/env python3
"""Count spans with oversized attributes"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

write_answer(
    str(get_scalar_from_sql_query("select count(*) from spans where length(attributes) > 102400"))
)
