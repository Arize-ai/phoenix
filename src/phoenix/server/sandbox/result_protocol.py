"""Framing protocol for serialized sandbox evaluator results."""

import re
from typing import Optional

PHOENIX_RESULT_BEGIN = "===PHOENIX_RESULT_BEGIN==="
PHOENIX_RESULT_END = "===PHOENIX_RESULT_END==="

_RESULT_BEGIN_RE = re.compile(
    r"^" + re.escape(PHOENIX_RESULT_BEGIN) + r"\s*$",
    re.MULTILINE,
)
_RESULT_END_RE = re.compile(
    r"^" + re.escape(PHOENIX_RESULT_END) + r"\s*$",
    re.MULTILINE,
)


def frame_result(payload: str) -> str:
    """Wrap a serialized result in a complete protocol frame."""
    return f"{PHOENIX_RESULT_BEGIN}\n{payload}\n{PHOENIX_RESULT_END}\n"


def append_framed_result(stdout: str, payload: str) -> str:
    """Append a framed result on a new line without otherwise changing stdout."""
    separator = "" if not stdout or stdout.endswith("\n") else "\n"
    return f"{stdout}{separator}{frame_result(payload)}"


def extract_framed_result(stdout: str) -> tuple[Optional[str], str]:
    """Extract the last complete result frame and return remaining stdout."""
    begin_matches = list(_RESULT_BEGIN_RE.finditer(stdout))
    end_matches = list(_RESULT_END_RE.finditer(stdout))
    if not begin_matches or not end_matches:
        return None, stdout

    pairs: list[tuple[re.Match[str], re.Match[str]]] = []
    end_index = 0
    for begin in begin_matches:
        while end_index < len(end_matches) and end_matches[end_index].start() <= begin.end():
            end_index += 1
        if end_index >= len(end_matches):
            break
        pairs.append((begin, end_matches[end_index]))
        end_index += 1

    if not pairs:
        return None, stdout

    last_begin, last_end = pairs[-1]
    framed = stdout[last_begin.end() : last_end.start()].strip("\r\n")
    before = stdout[: last_begin.start()].rstrip("\r\n")
    after = stdout[last_end.end() :].lstrip("\r\n")
    remaining_stdout = ("\n".join(part for part in (before, after) if part)).rstrip()
    return framed, remaining_stdout
