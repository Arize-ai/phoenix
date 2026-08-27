from pathlib import Path

import pytest

pytest.importorskip("guardrails")

from scripts.datagen.guardrailed_app import record
from scripts.datagen.recording import fixtures_for


def test_guardrail_fixture_records_a_fragment(tmp_path: Path) -> None:
    fixture = fixtures_for("guardrailed")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    assert fragments[0]["trace_ids"]
