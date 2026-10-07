#!/usr/bin/env python3
"""Count spans whose parent is missing"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar("""
select count(*) from spans c
where c.parent_id is not null and not exists (select 1 from spans p where p.span_id = c.parent_id)
""")
write_answer(str(n))
