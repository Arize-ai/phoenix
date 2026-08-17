"""Derivation of metrics from a run's raw stream-json transcript.

Kept separate from the runner so metrics can be added or corrected by re-running
``analyze`` over transcripts already on disk, without spending the matrix again.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
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
    #: Epoch seconds bracketing the call: the model emitting it, and its result
    #: arriving. The span covers the server's own work plus any queueing or retry
    #: wait in front of it.
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    #: What the call was about, for the meta-tools whose name alone says nothing:
    #: which operations the sandbox invoked, or which schemas were fetched.
    detail: Optional[str] = None

    @property
    def duration_ms(self) -> Optional[int]:
        if self.started_at is None or self.ended_at is None:
            return None
        return max(0, round((self.ended_at - self.started_at) * 1000))

    @property
    def is_discovery(self) -> bool:
        return self.tool_name.split("__")[-1] in _DISCOVERY_TOOLS


def _event_time(event: dict[str, Any]) -> Optional[float]:
    """Epoch seconds for a transcript event, or ``None`` if it carries no clock.

    Only assistant and user events are stamped, which is enough to time a tool
    call: it is issued on one and answered on the other.
    """
    stamp = event.get("timestamp")
    if not isinstance(stamp, str):
        return None
    try:
        return datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


#: Operations the sandbox invokes from inside `execute`. The tool name is always
#: "execute", so the operation is the only thing that says what a call did.
_CALL_TOOL = re.compile(r"""call_tool\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]""")

#: The analytics SQL surface, mapped to how it is reported. These are the tools
#: the benchmark exists to measure, so whether a run reached them is a result in
#: its own right rather than a detail of the route.
_ANALYTICS_TOOLS = {"executeSql": "sql", "describeSqlSchema": "schema"}


def _call_detail(tool_name: str, payload: Any) -> Optional[str]:
    """What a meta-tool call was about, or ``None`` when the name suffices.

    ``execute`` and ``get_schema`` are pass-throughs: every run is a row of
    identical names unless the operation underneath is named too.
    """
    if not isinstance(payload, dict):
        return None
    short = tool_name.split("__")[-1]
    if short == "execute":
        names = dict.fromkeys(_CALL_TOOL.findall(str(payload.get("code") or "")))
        return ",".join(names) or None
    if short == "get_schema":
        tools = payload.get("tools")
        if isinstance(tools, list):
            return ",".join(str(t) for t in tools) or None
    if short == "search":
        # The wording decides what gets surfaced, so it is the whole content of
        # the step: a query naming the data finds different tools than one
        # naming an operation.
        query = str(payload.get("query") or "").strip()
        return f'"{query}"' if query else None
    return None


def _payload_error(content: Any) -> Optional[str]:
    """Error code from a result that reports failure in its own payload.

    A rejected query is an ordinary successful tool call carrying an ``error``
    object -- the sandbox ran fine, the SQL did not -- so nothing upstream marks
    it. Detected structurally rather than by looking for the word, since results
    legitimately contain error counts and error messages as data.
    """
    text = content if isinstance(content, str) else None
    if text is None:
        for block in content if isinstance(content, list) else []:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                text = block["text"]
                break
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
    error = parsed.get("error") if isinstance(parsed, dict) else None
    if isinstance(error, dict) and (code := error.get("code")):
        return f"tool_{code}"
    return None


#: The sandbox reports a raised exception as plain prose rather than as the
#: structured error a rejected query gets, so the class name is recovered from
#: the message. Worth separating: `NameError` here is almost always state lost
#: between calls, not a mistake in the program.
_RAISED = re.compile(r"Error calling tool '[^']*':\s*([A-Za-z_][A-Za-z0-9_]*(?:Error|Exception))")


def _error_kind(text: str) -> Optional[str]:
    lowered = text.lower()
    for needle, kind in _SANDBOX_ERRORS:
        if needle in lowered:
            return kind
    if raised := _RAISED.search(text):
        return raised.group(1)
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
    def tool_time_ms(self) -> int:
        """Wall time the run spent waiting on tool calls.

        One assistant message can issue several calls at once, and those run
        concurrently -- summing their durations would charge the same seconds
        twice -- so overlapping spans are merged before totalling. This is the
        bulk of the gap between wall clock and time inside the model.
        """
        spans = sorted(
            (c.started_at, c.ended_at)
            for c in self.tool_calls
            if c.started_at is not None and c.ended_at is not None
        )
        total = 0.0
        merged: list[list[float]] = []
        for start, end in spans:
            if merged and start <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], end)
            else:
                merged.append([start, end])
        for start, end in merged:
            total += end - start
        return round(total * 1000)

    @property
    def max_tool_time_ms(self) -> int:
        """Slowest single call -- a sum hides one long stall among many quick ones."""
        return max((c.duration_ms or 0 for c in self.tool_calls), default=0)

    @property
    def tool_sequence(self) -> str:
        """The route the run took, as an ordered list of tool names.

        Consecutive repeats are collapsed to ``name xN``: a run that pages four
        times reads as one step rather than four identical ones, and the shape
        of the route -- how much discovery came before the first real call, and
        whether it went back for more -- stays visible.
        """
        steps: list[list[Any]] = []
        for call in self.tool_calls:
            name = call.tool_name.split("__")[-1]
            if call.detail:
                name = f"{name}({call.detail})"
            if call.is_error:
                # Marks a step the run had to recover from, which is otherwise
                # indistinguishable from deliberately calling the same tool
                # twice. Named where known, since why it failed is the point.
                name += f"!({call.error_kind})" if call.error_kind else "!"
            # Keyed on the rendered step: two executes calling different
            # operations are different work and must not merge.
            if steps and steps[-1][0] == name:
                steps[-1][1] += 1
            else:
                steps.append([name, 1])
        return " → ".join(name if n == 1 else f"{name} x{n}" for name, n in steps)

    @property
    def sql_tools(self) -> str:
        """Whether the analytics SQL tools were reached, and how far.

        Being surfaced by discovery and being called are different outcomes: a
        run that saw ``executeSql`` in a schema listing and paged anyway is the
        case worth seeing, and it is invisible if only calls are counted.
        """
        used, found = set(), set()
        for call in self.tool_calls:
            if not call.detail:
                continue
            short = call.tool_name.split("__")[-1]
            for op in call.detail.split(","):
                if op not in _ANALYTICS_TOOLS:
                    continue
                (used if short == "execute" else found).add(_ANALYTICS_TOOLS[op])
        if used:
            return "+".join(sorted(used))
        return "found, unused" if found else "–"

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
    issued_at: dict[str, Optional[float]] = {}
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
                    detail=_call_detail(str(block.get("name", "")), block.get("input")),
                )
                transcript.tool_calls.append(call)
                if use_id := block.get("id"):
                    pending[str(use_id)] = call
                    issued_at[str(use_id)] = _event_time(event)
        elif kind == "user":
            for block in event.get("message", {}).get("content", []) or []:
                if not isinstance(block, dict) or block.get("type") != "tool_result":
                    continue
                content = json.dumps(block.get("content"), default=str)
                use_id = str(block.get("tool_use_id", ""))
                call = pending.pop(use_id, None)
                if call is None:
                    continue
                call.started_at = issued_at.pop(use_id, None)
                call.ended_at = _event_time(event)
                call.result_bytes = len(content)
                call.error_kind = _error_kind(content) or _payload_error(block.get("content"))
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
    """Token totals for one run.

    ``peak_context_tokens`` is the reported metric: the conversation only grows,
    so it is the length at the point of answering, and what has to fit in the
    window. The summed totals are kept because cost is derived from them, but a
    sum over calls counts re-read text once per call and reads as inflated.

    Both are invariant to prompt-cache warmth, which shifts tokens between the
    cached and uncached fields (and therefore moves cost) without changing the
    work done.
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
    # How large the conversation actually grew, as distinct from the summed
    # figure: every call re-reads the whole conversation, so a token near the
    # front is counted once per call that follows it. Both are real -- one is
    # what gets billed, the other is what has to fit in the window.
    totals["peak_context_tokens"] = max(
        (
            turn["input_tokens"]
            + turn["cache_creation_input_tokens"]
            + turn["cache_read_input_tokens"]
            for turn in transcript.turns
        ),
        default=0,
    )
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
        "sql_tools": transcript.sql_tools,
        "tool_sequence": transcript.tool_sequence,
        "n_execute_calls": transcript.n_execute_calls,
        "n_discovery_calls": transcript.n_discovery_calls,
        "tool_time_ms": transcript.tool_time_ms,
        "max_tool_time_ms": transcript.max_tool_time_ms,
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
    row.update(cost_breakdown(result))
    # Explains cost variance that the cache-invariant primary metric hides.
    total_context = row["total_context_tokens"]
    row["cache_read_ratio"] = (
        row["cache_read_input_tokens"] / total_context if total_context else None
    )
    return row


#: Cache multipliers on base input price. A 1h entry costs more to write than a
#: 5m one; both read back at a tenth of base.
_CACHE_WRITE_1H, _CACHE_WRITE_5M, _CACHE_READ = 2.0, 1.25, 0.1


def cost_breakdown(result: dict[str, Any]) -> dict[str, Any]:
    """Split the reported cost into the four things that are priced separately.

    ``total_cost_usd`` is a single figure covering every model a run touched,
    including the ones the client spends on its own bookkeeping. Splitting it
    shows which component dominates: for a run that re-reads a long context,
    cache traffic exceeds generation several times over.
    """
    per_model = result.get("modelUsage") or {}
    out: dict[str, Any] = {
        "cost_input_usd": None,
        "cost_output_usd": None,
        "cost_cache_write_usd": None,
        "cost_cache_read_usd": None,
        "cost_other_models_usd": 0.0,
    }
    usage = result.get("usage") or {}
    creation = usage.get("cache_creation") or {}
    # The task model is whichever one the run's own usage totals describe; any
    # other entry is client overhead, not work the question asked for.
    task_out = usage.get("output_tokens")
    for name, m in per_model.items():
        if task_out is not None and m.get("outputTokens") == task_out:
            unit = _unit_prices(m, creation)
            if unit is None:
                continue
            price_in, price_out = unit
            out["cost_input_usd"] = m["inputTokens"] * price_in
            out["cost_output_usd"] = m["outputTokens"] * price_out
            out["cost_cache_read_usd"] = m["cacheReadInputTokens"] * price_in * _CACHE_READ
            out["cost_cache_write_usd"] = price_in * (
                creation.get("ephemeral_1h_input_tokens", 0) * _CACHE_WRITE_1H
                + creation.get("ephemeral_5m_input_tokens", 0) * _CACHE_WRITE_5M
            )
            out["cost_model"] = name
        else:
            out["cost_other_models_usd"] += m.get("costUSD") or 0.0
    return out


def _unit_prices(m: dict[str, Any], creation: dict[str, Any]) -> tuple[float, float] | None:
    """Recover per-token input and output prices from one model's reported cost.

    Solving for them rather than hardcoding a rate card keeps the split correct
    when prices change, and keeps it summing to the figure actually reported.
    """
    weighted_in = (
        m.get("inputTokens", 0)
        + m.get("cacheReadInputTokens", 0) * _CACHE_READ
        + creation.get("ephemeral_1h_input_tokens", 0) * _CACHE_WRITE_1H
        + creation.get("ephemeral_5m_input_tokens", 0) * _CACHE_WRITE_5M
    )
    out_tokens = m.get("outputTokens", 0)
    cost = m.get("costUSD")
    if cost is None or not weighted_in or not out_tokens:
        return None
    # Output is priced at 5x input across the current model line; that ratio is
    # the one extra equation needed to split a single total into two unknowns.
    price_in = cost / (weighted_in + out_tokens * 5.0)
    return price_in, price_in * 5.0


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
            "duration_ms": call.duration_ms,
            "detail": call.detail,
        }
        for call in transcript.tool_calls
    ]
