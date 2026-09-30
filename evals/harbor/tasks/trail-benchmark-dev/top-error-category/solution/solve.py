#!/usr/bin/env python3
"""The most frequent trail_error annotation label."""

import sys

sys.path.insert(0, "/opt/verifier")

from collections import Counter

from evals.harbor.verifiers.phoenix_api import annotation_labels

labels = Counter(annotation_labels("research-assistant", "trail_error"))
top = max(labels.values())
print(", ".join(sorted(label for label, count in labels.items() if count == top)))
