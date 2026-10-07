#!/usr/bin/env python3
"""Output type of a built-in evaluator"""

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

(evaluator,) = [
    e
    for e in graphql(
        "{ builtInEvaluators { name outputConfigs { __typename"
        " ... on ContinuousAnnotationConfig { optimizationDirection lowerBound upperBound }"
        " ... on CategoricalAnnotationConfig { optimizationDirection } } } }"
    )["builtInEvaluators"]
    if e["name"] == "levenshtein_distance"
]
(config,) = evaluator["outputConfigs"]
write_answer(
    f"{config['__typename'].replace('AnnotationConfig', '').lower()}, {config['optimizationDirection']} "
    f"(lower bound {config.get('lowerBound')}, upper bound {config.get('upperBound')})"
)
