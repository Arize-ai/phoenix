import json
from dataclasses import replace
from pathlib import Path
from typing import Any, cast

import pytest

pytest.importorskip("openinference.instrumentation.openai")

from openai import OpenAI

from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
from scripts.datagen.openai_chat_sessions import _DISPOSITION_PROMPTS, _WIND_DOWN_SUFFIX, record
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


def test_live_plain_chat_simulates_later_user_turns(tmp_path: Path) -> None:
    fixture = fixtures_for("plain_chat")[0]
    # Pin the authored opening: live runs otherwise pick a random phrasing
    # from the fixture's opening_variants.
    fixture = replace(
        fixture,
        inputs={key: value for key, value in fixture.inputs.items() if key != "opening_variants"},
    )
    turns = fixture.inputs["turns"]
    assert isinstance(turns, list)
    simulated_users = (
        "when does that hit my card",
        "wait it was a gift, can i size up instead?",
        "actually nvm. does opening it change the deadline",
    )
    provider = ScriptedOpenAIProvider(
        (
            {"content": "You can return it within 30 days."},
            {"content": simulated_users[0]},
            {"content": "The credit normally appears within ten business days."},
            {"content": simulated_users[1]},
            {"content": "A gift exchange depends on stock availability."},
            {"content": simulated_users[2]},
            {"content": "Opening the shipping packaging does not change the deadline."},
        )
    )
    client = OpenAI(
        api_key="datagen-dummy-key",
        base_url="https://datagen.test/v1",
        http_client=cast(Any, provider.http_client()),
        max_retries=0,
    )

    fragments = record(
        tmp_path,
        fixtures=(fixture,),
        provider="live",
        model="test-live-model",
        live_client=client,
        disposition="terse_expert",
        target_turns=4,
    )

    # Four user turns: the opening, two engaged simulated turns, and a
    # wind-down turn whose simulated message carries no further question, so
    # the conversation closes organically after the assistant's final reply.
    assert fragments[0]["trace_ids"]
    assert len(provider.requests) == 7
    assert {request["model"] for request in provider.requests} == {"test-live-model"}
    assert provider.requests[0]["messages"] == [{"role": "user", "content": turns[0]["user"]}]
    assert [
        provider.requests[index]["messages"][-1]["content"]
        for index in range(2, len(provider.requests), 2)
    ] == list(simulated_users)
    system_prompts = [
        provider.requests[index]["messages"][0]["content"]
        for index in range(1, len(provider.requests), 2)
    ]
    assert all(prompt.startswith(_DISPOSITION_PROMPTS["terse_expert"]) for prompt in system_prompts)
    assert system_prompts[-1].endswith(_WIND_DOWN_SUFFIX)
    assert not any(prompt.endswith(_WIND_DOWN_SUFFIX) for prompt in system_prompts[:-1])
    spans = _spans(tmp_path / "traces.jsonl")
    assert len(spans) == 4
    assert all(
        text not in json.dumps(span)
        for span in spans
        for text in (*_DISPOSITION_PROMPTS.values(), _WIND_DOWN_SUFFIX)
    )
    assert {
        attribute["value"]["stringValue"]
        for span in spans
        for attribute in span["attributes"]
        if attribute["key"] == "session.id"
    } == {fixture.fragment_id}


def _spans(path: Path) -> list[dict[str, Any]]:
    return [
        span
        for line in path.read_text().splitlines()
        for resource in json.loads(line)["resourceSpans"]
        for scope in resource["scopeSpans"]
        for span in scope["spans"]
    ]
