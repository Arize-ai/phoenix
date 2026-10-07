#!/usr/bin/env python3
"""Count examples edited after creation"""

from harbor_verifiers.phoenix_api import scalar, write_answer

n = scalar(
    "select count(*) from (select dataset_example_id from dataset_example_revisions group by dataset_example_id having count(*) > 1)"
)
write_answer(str(n))
