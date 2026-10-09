#!/usr/bin/env python3
"""Count projects without traces"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

write_answer(
    str(
        get_scalar_from_sql_query(
            "select count(*) from projects p where not exists (select 1 from traces t where t.project_rowid = p.id)"
        )
    )
)
