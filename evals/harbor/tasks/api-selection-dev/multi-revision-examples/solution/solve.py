#!/usr/bin/env python3
"""Count examples edited after creation"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

n = get_scalar_from_sql_query(
    "select count(*) from (select dataset_example_id from dataset_example_revisions group by dataset_example_id having count(*) > 1)"
)
write_answer(str(n))
