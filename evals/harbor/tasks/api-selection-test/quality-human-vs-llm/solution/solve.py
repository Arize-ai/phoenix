#!/usr/bin/env python3
"""Human versus LLM quality scores"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select annotator_kind, round(avg(score), 3) as mean, count(*) as n
from span_annotations where name = 'quality' group by annotator_kind order by annotator_kind
""")
write_answer("; ".join(f"{r['annotator_kind']} mean {r['mean']} over {r['n']}" for r in rows))
