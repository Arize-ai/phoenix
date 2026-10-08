#!/usr/bin/env python3
"""Count errored evaluation annotations"""

from harbor_verifiers.phoenix_api import get_scalar_from_sql_query, write_answer

write_answer(str(get_scalar_from_sql_query("select count(*) from experiment_run_annotations where error is not null")))
