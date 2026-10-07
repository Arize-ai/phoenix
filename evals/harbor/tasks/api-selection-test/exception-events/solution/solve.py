#!/usr/bin/env python3
"""Count spans with an exception event"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(*) from spans s, json_each(s.events) e
where json_extract(e.value, '$.name') = 'exception'
""")
write_answer(str(n))
