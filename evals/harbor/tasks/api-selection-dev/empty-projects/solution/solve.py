#!/usr/bin/env python3
"""Count projects without traces"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(
    str(
        scalar(
            "select count(*) from projects p where not exists (select 1 from traces t where t.project_rowid = p.id)"
        )
    )
)
