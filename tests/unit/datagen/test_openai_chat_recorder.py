import json
from pathlib import Path
from typing import Any

from openai import OpenAI

from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
from scripts.datagen.openai_chat_sessions import record
from scripts.datagen.recording import fixtures_for


def test_plain_chat_fixture_records_a_fragment(tmp_path: Path) -> None:
    fixture = fixtures_for("plain_chat")[0]

    fragments = record(tmp_path, fixtures=(fixture,))

    assert fragments[0]["fragment_id"] == fixture.fragment_id
    assert fragments[0]["trace_ids"]
    assert json.loads((tmp_path / "fragments.jsonl").read_text()) == fragments[0]
    spans = _spans(tmp_path / "traces.jsonl")
    assert {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "session.id"
    } == {fixture.fragment_id}
    assert {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "openinference.span.kind"
    } == {"LLM"}


def test_live_client_error_with_a_span_still_records_a_fragment(tmp_path: Path) -> None:
    fixture = fixtures_for("plain_chat")[0]
    responses = ScriptedOpenAIProvider(({"status": 500, "error": {"message": "model failed"}},))
    client = OpenAI(
        api_key="datagen-dummy-key",
        base_url="https://datagen.test/v1",
        http_client=responses.http_client(),
        max_retries=0,
    )

    fragments = record(
        tmp_path,
        fixtures=(fixture,),
        provider="live",
        model="live-test-model",
        live_client=client,
    )

    assert fragments[0]["trace_ids"]
    assert json.loads((tmp_path / "fragments.jsonl").read_text()) == fragments[0]
    assert _spans(tmp_path / "traces.jsonl")


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
