#!/usr/bin/env python3
"""Most frequent trail_error annotation label."""

import sys

sys.path.insert(0, "/opt/verifier")

from collections import Counter

from evals.harbor.lib.phoenix_query import project_spans, write_answer

labels = Counter(
    annotation["label"]
    for span in project_spans("research-assistant")
    for annotation in span["spanAnnotations"]
    if annotation["name"] == "trail_error" and annotation["label"]
)
top = max(labels.values())
write_answer(", ".join(sorted(label for label, count in labels.items() if count == top)))
