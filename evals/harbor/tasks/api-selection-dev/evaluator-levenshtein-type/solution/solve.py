#!/usr/bin/env python3
"""Output type of a built-in evaluator"""

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
