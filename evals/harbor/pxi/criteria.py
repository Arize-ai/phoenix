"""Reward Kit criteria for the PXI turn evaluators.

A PXI task's ``tests/`` directory holds ``test.sh``, ``reward.toml``, and one subdirectory
per evaluator name whose ``check.py`` calls :func:`declare`. The criterion registers only
when the task's example declares that evaluator, and Reward Kit skips directories that
register nothing, so ``reward.json`` carries exactly the declared evaluators as dimensions
and ``reward.toml`` combines them into ``reward``. The Phoenix Harbor plugin records each
key as a named experiment evaluation.

The verifier reads the seed the agent stored in the trajectory's ``extra`` at
``/logs/agent/trajectory.json``, fetches the session transcript once from the Phoenix
server the healthcheck started, drops the seeded prefix, converts the new assistant parts
to the message shape the PXI evaluators score, and runs the evaluators the dataset declares.
"""

from __future__ import annotations

import json
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from evals.harbor.pxi.evaluators import EVALUATORS_BY_NAME

TRAJECTORY_PATH = Path("/logs/agent/trajectory.json")
BASE_URL = "http://127.0.0.1:6006"

_TOOL_PREFIX = "tool-"
_lock = threading.Lock()
_factory_registered = False


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


def read_seed(trajectory_path: Path | None = None) -> dict[str, Any]:
    """The session id, example, and scoring record the agent left in the trajectory."""
    path = TRAJECTORY_PATH if trajectory_path is None else trajectory_path
    try:
        trajectory = json.loads(path.read_text())
    except OSError as exc:
        raise FileNotFoundError(
            f"No agent trajectory at {path}; the PXI verifier needs the seed it carries"
        ) from exc
    seed = trajectory["extra"]["pxi"]
    return {"session_id": trajectory["session_id"], **seed}


def declared_evaluators(trajectory_path: Path | None = None) -> list[str]:
    example = read_seed(trajectory_path)["example"]
    return [str(name) for name in example.get("evaluators") or []]


@lru_cache(maxsize=None)
def _turn_results(trajectory_path: Path, base_url: str) -> dict[str, dict[str, Any]]:
    seed = read_seed(trajectory_path)
    transcript = fetch_session_messages(base_url, seed["session_id"])
    output = evaluator_output(scored_messages(transcript, seed["scoring"]))
    return run_evaluators(seed["example"], output)


def evaluator_score(
    evaluator: str, trajectory_path: Path | None = None, base_url: str | None = None
) -> float:
    """Score one declared evaluator against the turn; the transcript is fetched once."""
    path = TRAJECTORY_PATH if trajectory_path is None else trajectory_path
    with _lock:
        results = _turn_results(path, BASE_URL if base_url is None else base_url)
    result = results.get(evaluator)
    if result is None:
        raise KeyError(f"the example does not declare evaluator {evaluator!r}")
    if result.get("error"):
        raise RuntimeError(str(result["error"]))
    return float(result["score"])


def _register_factory() -> None:
    global _factory_registered
    if _factory_registered:
        return
    from rewardkit import criterion

    @criterion(description="PXI evaluator {evaluator} passes", shared=True)  # type: ignore[untyped-decorator]
    def pxi_evaluator(workspace: Path, evaluator: str) -> float:
        return evaluator_score(evaluator)

    _factory_registered = True


def declare(evaluator: str) -> None:
    """Register the Reward Kit criterion for ``evaluator`` if the example declares it."""
    if evaluator not in EVALUATORS_BY_NAME:
        raise ValueError(
            f"unknown evaluator {evaluator!r}; see evals/harbor/pxi/evaluators/__init__.py"
        )
    if evaluator not in declared_evaluators():
        return
    _register_factory()
    import rewardkit as rk

    rk.pxi_evaluator(evaluator, name=evaluator)
