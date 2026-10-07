#!/usr/bin/env python3
"""Notes on the root span of a trace"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    attribute,
    dataset_id,
    experiment_by_name,
    experiment_runs,
    generative_models,
    graphql,
    rest,
    rest_pages,
    rowid,
    utc,
    write_answer,
)

trace = graphql(
    "query($t: String!) { getTraceByOtelId(traceId: $t) { rootSpan { spanId spanNotes { explanation } } } }",
    {"t": "660d6a9fe57e74b3b64d7e075d20ec78"},
)["getTraceByOtelId"]
notes = [n["explanation"] for n in trace["rootSpan"]["spanNotes"]]
write_answer(f"{len(notes)} note(s) on span {trace['rootSpan']['spanId']}: " + " | ".join(notes))
