"""Offline tests for recording judge requests and scoring their prompts."""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import httpx
import pytest

from harbor_verifiers import judge_prompts
from harbor_verifiers.judge_prompts import LLMCall


@pytest.fixture
def fake_openai(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[dict[str, Any]]]:
    """Serves a fake provider that echoes the request and records what it received."""
    received: list[dict[str, Any]] = []

    class Echo(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            body = self.rfile.read(int(self.headers["Content-Length"]))
            received.append({"path": self.path, "auth": self.headers.get("Authorization")})
            content = json.dumps({"echo": json.loads(body)}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *args: Any) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Echo)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setitem(
        judge_prompts.UPSTREAMS, "openai", f"http://127.0.0.1:{server.server_address[1]}"
    )
    yield received
    server.shutdown()
    server.server_close()


def test_recorder_forwards_and_records(fake_openai: list[dict[str, Any]]) -> None:
    body = {"model": "gpt-4.1-mini", "messages": [{"role": "user", "content": "hi"}]}
    with judge_prompts.record_llm_calls() as recorder:
        response = httpx.post(
            recorder.env["OPENAI_BASE_URL"] + "/chat/completions",
            json=body,
            headers={"Authorization": "Bearer test"},
        )
    assert response.json() == {"echo": body}
    assert fake_openai == [{"path": "/v1/chat/completions", "auth": "Bearer test"}]
    assert [(c.provider, c.model, c.status) for c in recorder.calls] == [
        ("openai", "gpt-4.1-mini", 200)
    ]


def test_recorder_refuses_other_models(fake_openai: list[dict[str, Any]]) -> None:
    body = {"model": "gpt-5.6-luna", "messages": []}
    with judge_prompts.record_llm_calls(allowed_models={"gpt-4.1-mini"}) as recorder:
        response = httpx.post(recorder.env["OPENAI_BASE_URL"] + "/chat/completions", json=body)
    assert response.status_code == 403
    assert "gpt-4.1-mini" in response.json()["error"]["message"]
    assert fake_openai == []
    assert recorder.calls[0].status == 403


def test_render_reads_openai_and_anthropic_requests() -> None:
    openai = LLMCall(
        "openai",
        "v1/chat/completions",
        {
            "model": "m",
            "messages": [
                {"role": "system", "content": "Judge grounding."},
                {"role": "user", "content": [{"type": "text", "text": "Reply: hello"}]},
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "extract_structured_data",
                        "parameters": {"properties": {"label": {"enum": ["pass", "fail"]}}},
                    },
                }
            ],
        },
        200,
    )
    anthropic = LLMCall(
        "anthropic",
        "v1/messages",
        {"model": "m", "system": "Judge.", "messages": [{"role": "user", "content": "x"}]},
        200,
    )
    text = judge_prompts.render(openai)
    assert "[system]\nJudge grounding." in text
    assert "[user]\nReply: hello" in text
    assert '"enum": ["pass", "fail"]' in text
    assert openai.uses_phoenix_evals
    assert judge_prompts.render(anthropic).startswith("[system]\nJudge.")
    assert not anthropic.uses_phoenix_evals


def test_seen_only_shingles_ignore_text_the_new_data_shares() -> None:
    template = "Thanks for reaching out, we have processed your refund request today."
    seen = [
        {
            "attributes": {
                "output.value": template + " The Summit boots were too narrow for my wide feet."
            }
        }
    ]
    unseen = [
        {
            "attributes": {
                "output.value": template + " The Ridgeline pack was too big for my short trips."
            }
        }
    ]
    runs = judge_prompts.seen_only_shingles(seen, unseen)
    assert judge_prompts.copied_runs("Judge this. " + template, runs) == []
    assert judge_prompts.copied_runs(
        "Example: the Summit boots were too narrow for my wide feet", runs
    )


def test_seen_only_ids() -> None:
    seen = [{"question": "Where is R-50112 for C-1001?"}]
    unseen = [{"question": "Where is R-50311 for C-1001?"}]
    assert judge_prompts.seen_only_ids(seen, unseen) == {"R-50112"}


def test_prompt_scores_without_requests() -> None:
    scores, details = judge_prompts.prompt_scores(
        [], system="s", criteria={"grounded": "g"}, evidence={"grounded": "e"}
    )
    assert scores == {"uses_phoenix_evals": 0.0, "prompt_quality": 0.0}
    assert details["judge_requests"] == 0


def test_prompt_scores_weight_templates(monkeypatch: pytest.MonkeyPatch) -> None:
    def call(prompt: str) -> LLMCall:
        body = {"model": "m", "messages": [{"role": "user", "content": prompt}]}
        return LLMCall("openai", "v1/chat/completions", body, 200)

    good = {"criteria_judged": ["grounded"], "explanation": "Fine.", "missed": []}
    combined = {
        "criteria_judged": ["grounded", "valid_format"],
        "explanation": "Asks for a 1-to-5 score.",
        "missed": ["named_labels"],
    }
    verdicts = {"Judge grounding": good, "Judge everything": combined}
    monkeypatch.setattr(
        judge_prompts,
        "_grade_request",
        lambda c, *_: verdicts[judge_prompts.render(c).split("\n")[1].split(":")[0]],
    )
    calls = [call("Judge grounding: a")] * 3 + [call("Judge everything: b")]
    scores, details = judge_prompts.prompt_scores(
        calls,
        system="s",
        criteria={"grounded": "g", "valid_format": "f"},
        evidence={"grounded": "e", "valid_format": "e"},
        deterministic=["valid_format"],
        copied=set(),
    )
    assert scores == {"uses_phoenix_evals": 0.0, "prompt_quality": 0.75}
    worst = details["templates"][1]
    assert worst["label"] == "needs_work"
    assert worst["missed"] == ["one_criterion", "needs_a_model", "named_labels"]


def test_prompt_scores_flag_copied_traces(monkeypatch: pytest.MonkeyPatch) -> None:
    example = "the summit boots were too narrow for my wide feet and rubbed"
    body = {
        "model": "m",
        "messages": [{"role": "user", "content": f"Example: {example}. Judge: x"}],
    }
    verdict = {"criteria_judged": ["grounded"], "explanation": "Fine.", "missed": []}
    monkeypatch.setattr(judge_prompts, "_grade_request", lambda *_: verdict)
    scores, details = judge_prompts.prompt_scores(
        [LLMCall("openai", "v1/chat/completions", body, 200)] * 3,
        system="s",
        criteria={"grounded": "g"},
        evidence={"grounded": "e"},
        copied=judge_prompts._shingles(example),
    )
    assert scores["prompt_quality"] == 0.0
    assert details["templates"][0]["missed"] == [judge_prompts.COPIED]
    assert "too narrow" in details["templates"][0]["explanation"]
