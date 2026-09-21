"""Score the turn a seeded PXI session produced and write Harbor's ``reward.json``.

Usage inside a task verifier::

    PYTHONPATH=/opt/verifier python -m evals.harbor.pxi.verify \
        --example /app/example.json --seed /app/seed.json

The verifier reads the session transcript back from the running Phoenix server, drops
the seeded prefix, converts the new assistant parts to the message shape the PXI
evaluators score, and runs the evaluators the dataset declares. The reward is 1 when
every evaluator passes. Each evaluator's own score is written alongside it.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import httpx

from evals.harbor.pxi.evaluators import EVALUATORS_BY_NAME
from evals.harbor.verifiers.verify import write_reward

_TOOL_PREFIX = "tool-"


def scored_messages(
    session_messages: list[dict[str, Any]], scoring: dict[str, Any]
) -> list[dict[str, Any]]:
    """The transcript messages the turn added, with seeded parts removed."""
    seeded_ids = set(scoring.get("seeded_message_ids") or [])
    resumed_id = scoring.get("resumed_message_id")
    seeded_part_count = int(scoring.get("seeded_part_count") or 0)
    client_message_id = scoring.get("client_message_id")
    messages: list[dict[str, Any]] = []
    for message in session_messages:
        if message.get("id") == resumed_id:
            messages.append(
                {**message, "parts": list(message.get("parts") or [])[seeded_part_count:]}
            )
        elif message.get("id") in seeded_ids or message.get("id") == client_message_id:
            continue
        else:
            messages.append(message)
    return messages


def _tool_name(part: dict[str, Any]) -> str:
    part_type = str(part.get("type", ""))
    if part_type == "dynamic-tool":
        return str(part.get("toolName", ""))
    return part_type[len(_TOOL_PREFIX) :]


def evaluator_output(ui_messages: list[dict[str, Any]]) -> dict[str, Any]:
    """Render UI messages as the Pydantic AI message dump the evaluators read."""
    messages: list[dict[str, Any]] = []
    texts: list[str] = []
    for message in ui_messages:
        if message.get("role") != "assistant":
            continue
        parts: list[dict[str, Any]] = []
        for part in message.get("parts") or []:
            part_type = str(part.get("type", ""))
            if part_type == "text":
                text = str(part.get("text", ""))
                texts.append(text)
                parts.append({"part_kind": "text", "content": text})
            elif part_type == "dynamic-tool" or part_type.startswith(_TOOL_PREFIX):
                args = part.get("input")
                parts.append(
                    {
                        "part_kind": "tool-call",
                        "tool_name": _tool_name(part),
                        "args": args if isinstance(args, dict) else {},
                        "tool_call_id": part.get("toolCallId"),
                    }
                )
        messages.append({"kind": "response", "parts": parts})
    return {
        "assistant_text": "\n".join(texts) if texts else None,
        "messages": messages,
        "raw_output_type": "AgentSessionTurn",
    }


def run_evaluators(example: dict[str, Any], output: dict[str, Any]) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    for name in example["evaluators"]:
        evaluator = EVALUATORS_BY_NAME.get(name)
        if evaluator is None:
            results[name] = {"score": 0.0, "error": f"unknown evaluator {name!r}"}
            continue
        try:
            scores = evaluator.evaluate({"output": output, "expected": example["expected"]})
        except Exception as exc:  # noqa: BLE001
            results[name] = {"score": 0.0, "error": f"{type(exc).__name__}: {exc}"}
            continue
        score = scores[0] if scores else None
        results[name] = {
            "score": float(score.score or 0.0) if score is not None else 0.0,
            "label": getattr(score, "label", None),
            "explanation": getattr(score, "explanation", None),
        }
    return results


def reward_from_results(results: dict[str, dict[str, Any]]) -> float:
    return 1.0 if results and all(r["score"] >= 1.0 for r in results.values()) else 0.0


def fetch_session_messages(base_url: str, session_id: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    cursor: str | None = None
    with httpx.Client(base_url=base_url, timeout=60.0) as http:
        while True:
            params: dict[str, str | int] = {"limit": 1000}
            if cursor:
                params["cursor"] = cursor
            response = http.get(f"/v1/agent_sessions/{session_id}/messages", params=params)
            response.raise_for_status()
            payload = response.json()
            messages.extend(payload["data"])
            cursor = payload.get("next_cursor")
            if not cursor:
                return messages


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--example", type=Path, default=Path("/app/example.json"))
    parser.add_argument("--seed", type=Path, default=Path("/app/seed.json"))
    parser.add_argument("--base-url", default="http://127.0.0.1:6006")
    parser.add_argument("--reward-file", type=Path, default=None)
    args = parser.parse_args(argv)
    example = json.loads(args.example.read_text())
    seed = json.loads(args.seed.read_text())
    transcript = fetch_session_messages(args.base_url, seed["session_id"])
    turn_messages = scored_messages(transcript, seed["scoring"])
    output = evaluator_output(turn_messages)
    results = run_evaluators(example, output)
    reward = reward_from_results(results)
    extra = {name: result["score"] for name, result in results.items()}
    if args.reward_file is not None:
        scores = write_reward(reward, reward_path=args.reward_file, **extra)
    else:
        scores = write_reward(reward, **extra)
    print(
        json.dumps(
            {
                "example": f"{example['dataset']}/{example['id']}",
                "scores": scores,
                "results": results,
                "tool_calls": [
                    {"tool_name": part["tool_name"], "args": part["args"]}
                    for message in output["messages"]
                    for part in message["parts"]
                    if part["part_kind"] == "tool-call"
                ],
                "assistant_text": (output["assistant_text"] or "")[:500],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
