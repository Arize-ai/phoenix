import inspect
from pathlib import Path

import pytest

pytest.importorskip("guardrails")

from scripts.datagen.guardrailed_app import record
from scripts.datagen.recording import fixtures_for


def test_guardrail_recorder_exposes_condition_and_append_only(tmp_path: Path) -> None:
    fixture = fixtures_for("guardrailed")[0]

    fragments = record(tmp_path, fixtures=(fixture,))
    parameters = inspect.signature(record).parameters

    assert fragments[0]["trace_ids"]
    assert {"condition", "append"} <= set(parameters)
    assert {"provider", "model"}.isdisjoint(parameters)
