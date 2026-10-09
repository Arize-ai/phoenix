#!/usr/bin/env python3
"""Top three models by spend"""

from harbor_verifiers.phoenix_api import execute_sql_query, write_answer

rows = execute_sql_query("""
select gm.name, round(sum(sc.total_cost), 2) as cost
from span_costs sc join generative_models gm on gm.id = sc.model_id
group by gm.name order by cost desc limit 3
""")
write_answer("; ".join(f"{r['name']} ${r['cost']:,.2f}" for r in rows))
