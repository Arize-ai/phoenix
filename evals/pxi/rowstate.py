"""Single source of truth for classifying a recorded eval row.

Both the record-only harness (``conftest.py``, which writes the aggregate
tallies into the artifact) and the gate (``gate.py``, which decides pass/fail)
must agree on what counts as an assessed pass, an assessed miss, or an excluded
infrastructure row. Keeping the rule in one place stops the two from drifting:
a change to the score/infra classification updates the uploaded aggregates and
the CI decision together instead of leaving them to disagree on the same run.
"""

from __future__ import annotations

import math
from typing import Any, Literal, Mapping

# Bumped whenever the artifact shape changes; the gate refuses to decide against
# any other version. Lives here so the writer (conftest) and the reader (gate)
# share exactly one constant.
SCHEMA_VERSION = 4

RowState = Literal["passed", "failed", "infra"]


def row_state(row: Mapping[str, Any]) -> RowState:
    """Classify a single recorded evaluator row.

    * ``infra`` -- the row carries no trustworthy behavioral verdict: the task
      never ran (``task_error``), the evaluator itself broke (``evaluator_error``),
      or no finite numeric score was recorded. These never enter a pass-rate
      denominator.
    * ``passed`` / ``failed`` -- an assessed behavioral verdict.
    """
    if row.get("task_error") or row.get("evaluator_error"):
        return "infra"
    score = row.get("score")
    if isinstance(score, bool) or not isinstance(score, (int, float)):
        return "infra"
    if not math.isfinite(float(score)):
        return "infra"
    return "passed" if row.get("passed") is True else "failed"
