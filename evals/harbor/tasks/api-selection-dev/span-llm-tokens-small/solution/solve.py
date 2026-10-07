#!/usr/bin/env python3
"""Token counts of the LLM span in a trace"""

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
    f"{llm['tokenCountTotal']} total, model {attribute(llm['attributes'], 'llm.model_name')} "
    f"(span {llm['spanId']})"
)
