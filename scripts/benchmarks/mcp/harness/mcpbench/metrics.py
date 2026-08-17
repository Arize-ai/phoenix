"""Derivation of metrics from a run's raw stream-json transcript.

Kept separate from the runner so metrics can be added or corrected by re-running
``analyze`` over transcripts already on disk, without spending the matrix again.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

#: Prefix of the result subtypes that mean the run hit a ceiling -- turns, or the
#: per-invocation budget -- rather than the harness breaking. These are data: a
#: run that burns its budget without finishing is exactly the expensive result the
#: benchmark exists to catch, and excluding it would flatter that run.
_EXHAUSTION_SUBTYPE_PREFIX = "error_max"


#: Discovery meta-tools. Calls to these are the fixed tax a run pays before it
#: can do the task, as distinct from productive work.
_DISCOVERY_TOOLS = frozenset(
    {
        "search",
        "get_schema",
        "tags",
        "list_tools",
        "list_tool_groups",
        "enable_tool_group",
    }
)

#: Substrings of the sandbox's own ToolError messages (see
#: phoenix/server/mcp_code_mode.py), mapped to a kind. These separate server
#: capacity problems from code the model got wrong -- if the former show up, the
#: run is measuring the sandbox pool rather than the tool surface.
_SANDBOX_ERRORS = (
    ("sandbox is busy running other execute calls", "sandbox_busy"),
    ("limit for a single execute call", "sandbox_deadline"),
    ("stopped responding for", "sandbox_worker_timeout"),
    ("sandbox process terminated while running this code", "sandbox_crashed"),
    ("code-mode sandbox could not be started", "sandbox_unavailable"),
    ("sandbox is shutting down", "sandbox_shutdown"),
    ("could not transfer its error details", "sandbox_lost_error"),
)


@dataclass
class ToolCall:
    """One tool call and the result it produced."""

    turn_idx: int
    tool_name: str
    input_bytes: int
    result_bytes: int = 0
    is_error: bool = False
    error_kind: Optional[str] = None

    @property
    def is_discovery(self) -> bool:
        return self.tool_name.split("__")[-1] in _DISCOVERY_TOOLS


def _error_kind(text: str) -> Optional[str]:
    lowered = text.lower()
    for needle, kind in _SANDBOX_ERRORS:
        if needle in lowered:
            return kind
    return None


@dataclass
class Transcript:
    """The parts of a stream-json transcript the benchmark reads."""

    init: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] = field(default_factory=dict)
    tool_calls: list[ToolCall] = field(default_factory=list)
    #: Per-API-call usage, one entry per assistant message in order. Derived from
    #: the messages rather than ``result.usage.iterations``, which collapses a
    #: whole multi-turn run into a single entry and undercounts by an order of
    #: magnitude on long runs.
    turns: list[dict[str, Any]] = field(default_factory=list)

    @property
    def mcp_status(self) -> Optional[str]:
        servers = self.init.get("mcp_servers") or []
        return servers[0].get("status") if servers else None

    @property
    def mcp_tools(self) -> list[str]:
        return [t for t in (self.init.get("tools") or []) if t.startswith("mcp__")]

    @property
    def n_tool_calls(self) -> int:
        return len(self.tool_calls)

    @property
    def n_execute_calls(self) -> int:
        return sum(1 for c in self.tool_calls if c.tool_name.split("__")[-1] == "execute")

    @property
    def n_discovery_calls(self) -> int:
        return sum(1 for c in self.tool_calls if c.is_discovery)

    @property
    def tool_result_bytes(self) -> int:
        return sum(c.result_bytes for c in self.tool_calls)

    @property
    def max_tool_result_bytes(self) -> int:
        """Largest single result. A sum cannot distinguish one huge payload from
        many small ones."""
        return max((c.result_bytes for c in self.tool_calls), default=0)

    @property
    def code_bytes(self) -> int:
        """Bytes of code passed to sandboxed execution, a driver of output tokens."""
        return sum(c.input_bytes for c in self.tool_calls if c.tool_name.endswith("execute"))

    @property
    def n_tool_errors(self) -> int:
        return sum(1 for c in self.tool_calls if c.is_error)

    @property
    def n_sandbox_errors(self) -> int:
        return sum(1 for c in self.tool_calls if (c.error_kind or "").startswith("sandbox_"))


def parse_transcript(path: Path) -> Transcript:
    """Read one JSONL transcript. Truncated trailing lines are tolerated.

    Tool calls are matched to their results by ``tool_use_id``, and turns are
    numbered by first appearance of an assistant message id -- one message
    arrives as several events (thinking, then text), so counting events would
    overcount turns.
    """
    transcript = Transcript()
    pending: dict[str, ToolCall] = {}
    turn_of_message: dict[str, int] = {}

    for line in path.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue

        kind = event.get("type")
        if kind == "system" and event.get("subtype") == "init":
            transcript.init = event
        elif kind == "result":
            transcript.result = event
        elif kind == "assistant":
            message = event.get("message", {}) or {}
            message_id = str(message.get("id", ""))
            if message_id not in turn_of_message:
                turn_of_message[message_id] = len(turn_of_message)
                # One message arrives as several events (thinking, then text or
                # tool_use) carrying identical usage; count it once.
                usage = message.get("usage") or {}
                transcript.turns.append(
                    {
                        "input_tokens": usage.get("input_tokens") or 0,
                        "output_tokens": usage.get("output_tokens") or 0,
                        "cache_creation_input_tokens": usage.get("cache_creation_input_tokens")
                        or 0,
                        "cache_read_input_tokens": usage.get("cache_read_input_tokens") or 0,
                    }
                )
            for block in message.get("content", []) or []:
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                call = ToolCall(
                    turn_idx=turn_of_message[message_id],
                    tool_name=str(block.get("name", "")),
                    input_bytes=len(json.dumps(block.get("input"), default=str)),
                )
                transcript.tool_calls.append(call)
                if use_id := block.get("id"):
                    pending[str(use_id)] = call
        elif kind == "user":
            for block in event.get("message", {}).get("content", []) or []:
                if not isinstance(block, dict) or block.get("type") != "tool_result":
                    continue
                content = json.dumps(block.get("content"), default=str)
                call = pending.pop(str(block.get("tool_use_id", "")), None)
                if call is None:
                    continue
                call.result_bytes = len(content)
                call.error_kind = _error_kind(content)
                # The sandbox reports some failures as ordinary results, so the
                # content is classified independently of the error flag.
                call.is_error = bool(block.get("is_error")) or call.error_kind is not None
    return transcript


def iteration_rows(transcript: Transcript) -> list[dict[str, Any]]:
    """One row per API call, for turn-by-turn context growth.

    Built from assistant-message usage, not ``result.usage.iterations``: that
    array reports a single entry no matter how many calls a run made.
    """
    return [{"turn_idx": i, **turn} for i, turn in enumerate(transcript.turns)]


def token_totals(transcript: Transcript) -> dict[str, int]:
    """Token totals, summed across API calls.

    ``total_context_tokens`` is the primary metric because it is invariant to
    prompt-cache warmth, which shifts tokens between the cached and uncached
    fields (and therefore moves cost) without changing the work done.
    """
    keys = (
        "input_tokens",
        "output_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
    )
    # The result-level usage is the authority: it is the run's own aggregate and
    # matches the sum over assistant messages exactly. Summing the per-turn rows
    # instead would be equivalent, but this survives a transcript whose messages
    # were truncated.
    usage = transcript.result.get("usage") or {}
    totals = {key: int(usage.get(key) or 0) for key in keys}
    rows = iteration_rows(transcript) or [totals]
    totals["total_context_tokens"] = (
        totals["input_tokens"]
        + totals["cache_creation_input_tokens"]
        + totals["cache_read_input_tokens"]
    )
    # Peak, not sum: what decides whether a run would still fit in a smaller
    # context window. A long cheap run and one enormous turn can sum alike.
    totals["peak_context_tokens"] = max(
        (
            int(row.get("input_tokens") or 0)
            + int(row.get("cache_creation_input_tokens") or 0)
            + int(row.get("cache_read_input_tokens") or 0)
        )
        for row in rows
    )
    return totals


def classify(transcript: Transcript) -> Optional[str]:
    """Return an invalidity reason, or None if the run is usable data.

    Only harness failures are invalid. A wrong answer, or a model burning tokens
    getting nowhere, is exactly the data the benchmark exists to collect --
    retrying those would quietly select for lucky runs.
    """
    if not transcript.result:
        return "no_result"
    # Whether a server was expected is read from the run itself: the init event
    # lists the servers that were configured. That keeps classification correct
    # when re-analysing runs made against different targets.
    if transcript.init.get("mcp_servers"):
        status = transcript.mcp_status
        if status != "connected":
            return f"mcp_{status or 'absent'}"
        if not transcript.mcp_tools:
            return "mcp_no_tools"
    if transcript.result.get("permission_denials"):
        return "permission_denied"
    if transcript.result.get("api_error_status"):
        return "api_error"
    subtype = transcript.result.get("subtype")
    if subtype and subtype != "success" and not subtype.startswith(_EXHAUSTION_SUBTYPE_PREFIX):
        return f"result_{subtype}"
    return None


def grade(expect: dict[str, Any], answer: str) -> Optional[bool]:
    """Grade an answer, or return None when the task declares no expectation.

    Ungraded runs stay distinguishable from passing ones downstream: comparing
    token cost without conditioning on correctness would rank a cheap label that
    answers wrongly above an accurate one.
    """
    if not expect:
        return None
    text = (answer or "").strip()

    if (contains := expect.get("contains")) is not None:
        needles = [contains] if isinstance(contains, str) else list(contains)
        return all(str(n).lower() in text.lower() for n in needles)
    if (pattern := expect.get("regex")) is not None:
        return re.search(str(pattern), text, re.IGNORECASE | re.DOTALL) is not None
    if (equals := expect.get("equals")) is not None:
        return text == str(equals).strip()
    if (subset := expect.get("json")) is not None:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return False
        if not isinstance(parsed, dict):
            return False
        return all(parsed.get(k) == v for k, v in subset.items())
    return None


def run_row(transcript: Transcript, *, expect: dict[str, Any]) -> dict[str, Any]:
    """The metrics for one run, minus the identifiers the caller supplies."""
    result = transcript.result
    answer = str(result.get("result") or "")
    invalid_reason = classify(transcript)
    passed = grade(expect, answer) if invalid_reason is None else None

    usage = result.get("usage") or {}
    details = usage.get("output_tokens_details") or {}

    row: dict[str, Any] = {
        "num_turns": result.get("num_turns"),
        "duration_ms": result.get("duration_ms"),
        # API time only; wall clock also carries per-tool-call hook subprocesses.
        "duration_api_ms": result.get("duration_api_ms"),
        "ttft_ms": result.get("ttft_ms"),
        "total_cost_usd": result.get("total_cost_usd"),
        "thinking_tokens": details.get("thinking_tokens"),
        "n_tool_calls": transcript.n_tool_calls,
        "n_execute_calls": transcript.n_execute_calls,
        "n_discovery_calls": transcript.n_discovery_calls,
        "n_tool_errors": transcript.n_tool_errors,
        "n_sandbox_errors": transcript.n_sandbox_errors,
        "code_bytes": transcript.code_bytes,
        "tool_result_bytes": transcript.tool_result_bytes,
        "max_tool_result_bytes": transcript.max_tool_result_bytes,
        "mcp_status": transcript.mcp_status,
        "n_mcp_tools": len(transcript.mcp_tools),
        "subtype": result.get("subtype"),
        "api_error_status": result.get("api_error_status"),
        "n_permission_denials": len(result.get("permission_denials") or []),
        "invalid": invalid_reason is not None,
        "invalid_reason": invalid_reason,
        "passed": passed,
        "graded": passed is not None,
        "session_id": result.get("session_id"),
        "cli_version": transcript.init.get("claude_code_version"),
        "answer": answer[:2000],
    }
    row.update(token_totals(transcript))
    # Explains cost variance that the cache-invariant primary metric hides.
    total_context = row["total_context_tokens"]
    row["cache_read_ratio"] = (
        row["cache_read_input_tokens"] / total_context if total_context else None
    )
    return row


def tool_call_rows(transcript: Transcript) -> list[dict[str, Any]]:
    """One row per tool call, for questions the scalar columns cannot answer."""
    return [
        {
            "turn_idx": call.turn_idx,
            "tool_name": call.tool_name,
            "short_name": call.tool_name.split("__")[-1],
            "is_discovery": call.is_discovery,
            "input_bytes": call.input_bytes,
            "result_bytes": call.result_bytes,
            "is_error": call.is_error,
            "error_kind": call.error_kind,
        }
        for call in transcript.tool_calls
    ]
