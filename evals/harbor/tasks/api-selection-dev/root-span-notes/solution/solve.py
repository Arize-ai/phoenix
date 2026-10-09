#!/usr/bin/env python3
"""Notes on the root span of a trace"""

import json  # noqa: F401
from collections import Counter  # noqa: F401

from harbor_verifiers.phoenix_api import (  # noqa: F401
    format_utc_timestamp,
    get_dataset_id_from_name,
    get_experiment_by_name,
    get_experiment_runs,
    get_generative_models,
    get_nested_attribute,
    graphql,
    rest,
    rest_pages,
    rowid,
    write_answer,
)

trace = graphql(
    "query($t: String!) { getTraceByOtelId(traceId: $t) { rootSpan { spanId spanNotes { explanation } } } }",
    {"t": "660d6a9fe57e74b3b64d7e075d20ec78"},
)["getTraceByOtelId"]
notes = [n["explanation"] for n in trace["rootSpan"]["spanNotes"]]
write_answer(f"{len(notes)} note(s) on span {trace['rootSpan']['spanId']}: " + " | ".join(notes))
