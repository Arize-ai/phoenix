#!/usr/bin/env python3
"""Count spans with an exception event"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query("""
select count(*) from spans s, json_each(s.events) e
where json_extract(e.value, '$.name') = 'exception'
""")
write_answer(str(n))
