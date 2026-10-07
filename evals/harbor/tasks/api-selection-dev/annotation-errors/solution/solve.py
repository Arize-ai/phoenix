#!/usr/bin/env python3
"""Count errored evaluation annotations"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(str(scalar("select count(*) from experiment_run_annotations where error is not null")))
