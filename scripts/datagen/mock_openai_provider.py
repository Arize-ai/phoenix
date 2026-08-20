#!/usr/bin/env python3
"""Serve deterministic, realistic OpenAI chat-completion responses."""

from __future__ import annotations

import argparse
import json
import re
import time
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


def _token_count(value: Any) -> int:
    text = (
        json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    )
    return max(1, round(len(text.split()) * 1.35))


def _latest_message(messages: list[dict[str, Any]], role: str) -> dict[str, Any] | None:
    return next(
        (message for message in reversed(messages) if message.get("role") == role), None
    )


def _tool_response(messages: list[dict[str, Any]]) -> str | None:
    tool_message = _latest_message(messages, "tool")
    if tool_message is None:
        return None
    return (
        "The retrieved policy and delivery estimate indicate that the order "
        "should arrive "
        f"{tool_message.get('content', 'within the quoted window')}. I would "
        "share that window with the customer and note that carrier scans can "
        "take several hours to appear."
    )


def _chat_response(messages: list[dict[str, Any]]) -> str:
    tool_answer = _tool_response(messages)
    if tool_answer:
        return tool_answer

    user = str((_latest_message(messages, "user") or {}).get("content", "")).lower()
    responses = (
        (
            ("activation", "onboarding"),
            "Start with the moment a new workspace reaches its first useful "
            "result. Measure the share of invited teams that connect a data "
            "source, run one analysis, and return within seven days; segment "
            "the funnel by team size and acquisition channel.",
        ),
        (
            ("assumption", "riskiest"),
            "The riskiest assumption is that setup effort, rather than unclear "
            "value, causes the drop-off. Validate it by interviewing recent "
            "abandoners and comparing a concierge setup cohort with the existing "
            "flow.",
        ),
        (
            ("experiment", "test"),
            "Run a two-week concierge onboarding test with 20 eligible teams. "
            "Pre-register activation and day-seven return rates, track support "
            "minutes per team, and stop if the treatment creates more than 30 "
            "minutes of manual work per workspace.",
        ),
        (
            ("summarize", "brief"),
            "Recommendation: test whether guided setup improves first-week "
            "activation. Owner: growth engineering. Success bar: a meaningful "
            "lift in activated teams without exceeding the support-time "
            "guardrail. Review the result after two weeks.",
        ),
        (
            ("latency", "p95"),
            "Compare p50, p95, and p99 latency by endpoint and region, then "
            "align the change with deployments, dependency timing, queue depth, "
            "and database wait time. A flat median with a rising tail usually "
            "points to saturation or a slow downstream dependency.",
        ),
        (
            ("metric", "dashboard"),
            "Add request volume, error rate, in-flight work, connection-pool "
            "utilization, and the slow dependency's duration on the same "
            "dashboard. Break each metric down by region and release version so "
            "the affected slice is visible.",
        ),
        (
            ("cause", "hypothesis"),
            "The strongest hypothesis is connection-pool contention during "
            "traffic bursts: it explains the tail-only slowdown and would appear "
            "as rising acquisition wait time before database duration increases. "
            "Confirm it with pool wait histograms and sampled slow traces.",
        ),
        (
            ("update", "stakeholder"),
            "Customer impact is limited to intermittent slow responses in one "
            "region; success rates remain normal. The team is testing database "
            "connection contention, has added capacity as a mitigation, and will "
            "post the next update in 30 minutes.",
        ),
        (
            ("garden", "volunteer"),
            "Plan the day around three clear jobs: bed preparation, planting, "
            "and cleanup. Assign a lead to each station, stage tools before "
            "volunteers arrive, and reserve the first ten minutes for safety "
            "guidance and the final fifteen for inventory.",
        ),
        (
            ("rain", "weather"),
            "Keep planting as the dry-weather priority and prepare an indoor "
            "fallback for seed sorting, tool maintenance, and signage. Decide by "
            "the prior evening using a published rainfall threshold so "
            "volunteers receive one clear message.",
        ),
        (
            ("materials", "bring"),
            "Ask volunteers to bring gloves, a refillable water bottle, and "
            "weather-appropriate layers. The organizers should provide labeled "
            "tools, first-aid supplies, sunscreen, drinking water, and a few "
            "spare pairs of gloves.",
        ),
        (
            ("reminder", "email"),
            "Subject: Saturday garden workday details\n\nWe will meet at 9:00 "
            "a.m. by the tool shed. Please bring gloves, water, and layers. We "
            "will confirm the outdoor or rain plan by 6:00 p.m. Friday. New "
            "volunteers are welcome; no gardening experience is required.",
        ),
        (
            ("return", "refund"),
            "The policy excerpt allows returns of unused items within 30 days. "
            "Ask the customer to use the prepaid label from the order page; the "
            "refund is issued to the original payment method after the warehouse "
            "scans the parcel.",
        ),
        (
            ("password", "account", "security"),
            "The account guidance recommends resetting the password, signing out "
            "other sessions, and enabling multi-factor authentication. If "
            "unfamiliar activity remains, escalate the case to the security "
            "queue with the relevant timestamps.",
        ),
    )
    for keywords, response in responses:
        if any(keyword in user for keyword in keywords):
            return response
    return (
        "Based on the supplied context, I would state the applicable policy "
        "first, give the customer a concrete next step, and call out any timing "
        "or eligibility condition that could change the outcome."
    )


def _tool_call(
    messages: list[dict[str, Any]], tools: list[dict[str, Any]]
) -> dict[str, Any] | None:
    if not tools or _latest_message(messages, "tool") is not None:
        return None
    user = str((_latest_message(messages, "user") or {}).get("content", ""))
    if not re.search(
        r"\b(arrive|delivery|deliver|shipping|shipment|order)\b", user, re.I
    ):
        return None
    function = tools[0].get("function", {}) if tools else {}
    postal_code = (re.search(r"\b\d{5}\b", user) or ["10001"])[0]
    service_level = (
        "express" if re.search(r"\b(express|expedited)\b", user, re.I) else "standard"
    )
    return {
        "id": f"call_{uuid.uuid4().hex[:18]}",
        "type": "function",
        "function": {
            "name": function.get("name", "estimate_delivery_days"),
            "arguments": json.dumps(
                {"postal_code": postal_code, "service_level": service_level},
                separators=(",", ":"),
            ),
        },
    }


def create_chat_completion(request: dict[str, Any]) -> dict[str, Any]:
    messages = request.get("messages", [])
    tools = request.get("tools", [])
    call = _tool_call(messages, tools)
    content = None if call else _chat_response(messages)
    completion_payload = call or content or ""
    prompt_tokens = (
        _token_count(messages) + _token_count(tools)
        if tools
        else _token_count(messages)
    )
    completion_tokens = _token_count(completion_payload)
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.get("model", "gpt-4.1-mini"),
        "system_fingerprint": "fp_datagen_corpus",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                    **({"tool_calls": [call]} if call else {}),
                },
                "finish_reason": "tool_calls" if call else "stop",
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "prompt_tokens_details": {"cached_tokens": 0},
            "completion_tokens_details": {"reasoning_tokens": 0},
        },
    }


class ChatCompletionsHandler(BaseHTTPRequestHandler):
    server_version = "DatagenMockOpenAI/1.0"

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(HTTPStatus.OK, {"status": "ok"})
        else:
            self._send_json(HTTPStatus.NOT_FOUND, {"error": {"message": "not found"}})

    def do_POST(self) -> None:
        if self.path != "/v1/chat/completions":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": {"message": "not found"}})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            request = json.loads(self.rfile.read(length))
            self._send_json(HTTPStatus.OK, create_chat_completion(request))
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": {"message": str(exc)}})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")

    def _send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), ChatCompletionsHandler)
    print(f"Mock OpenAI provider listening on http://{args.host}:{args.port}/v1")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
