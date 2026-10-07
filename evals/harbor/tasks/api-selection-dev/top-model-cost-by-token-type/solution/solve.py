#!/usr/bin/env python3
"""Cost breakdown by token type for the top model"""

from harbor_verifiers.phoenix_api import execute_sql, write_answer

rows = execute_sql("""
select d.token_type, round(sum(d.cost), 2) as cost
from span_cost_details d join span_costs sc on sc.id = d.span_cost_id
join generative_models gm on gm.id = sc.model_id
where gm.name = 'gpt-5.6-sol'
group by d.token_type order by cost desc
""")
total = sum(r["cost"] for r in rows)
write_answer(
    "; ".join(
        f"{r['token_type']} ${r['cost']:,.2f} ({100.0 * r['cost'] / total:.1f}%)"
        for r in rows
        if r["cost"]
    )
)
