#!/usr/bin/env python3
"""The default trace retention policy"""

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

policy = graphql(
    "{ defaultProjectTraceRetentionPolicy { name cronExpression rule { __typename"
    " ... on TraceRetentionRuleMaxDays { maxDays } ... on TraceRetentionRuleMaxCount { maxCount } } } }"
)["defaultProjectTraceRetentionPolicy"]
rule = {k: v for k, v in policy["rule"].items() if k != "__typename"}
days = rule.get("maxDays")
text = (
    f"max_days {days:g}" + (" (never deletes)" if days == 0 else "")
    if days is not None
    else str(rule)
)
write_answer(f"{policy['name']}, cron {policy['cronExpression']}, rule {text}")
