#!/usr/bin/env python3
"""Token counts of the LLM span in a trace"""

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

spans = [
    e["node"]
    for e in graphql(
        "query($t: String!) { getTraceByOtelId(traceId: $t) { spans(first: 100) { edges { node { spanId spanKind tokenCountPrompt tokenCountCompletion tokenCountTotal attributes } } } } }",
        {"t": "660d6a9fe57e74b3b64d7e075d20ec78"},
    )["getTraceByOtelId"]["spans"]["edges"]
]
(llm,) = [s for s in spans if s["spanKind"].lower() == "llm"]
write_answer(
    f"{llm['tokenCountPrompt']} prompt, {llm['tokenCountCompletion']} completion, "
    f"{llm['tokenCountTotal']} total, model {get_nested_attribute(llm['attributes'], 'llm.model_name')} "
    f"(span {llm['spanId']})"
)
