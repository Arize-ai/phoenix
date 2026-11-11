import json
from pathlib import Path
from typing import Any

import anthropic

FACTORY_DIR = Path(__file__).resolve().parent
MODEL = "claude-opus-5-5"
EFFORT = "medium"
MAX_TOKENS = 8192
TIMEOUT_SECONDS = 300
VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "reason"],
    "additionalProperties": False,
}


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError("Duplicate fields in the security verdict")
    return result


def parse_verdict(text: str) -> dict[str, str]:
    result = json.loads(text, object_pairs_hook=unique_object)
    if (
        not isinstance(result, dict)
        or set(result) != {"verdict", "reason"}
        or result["verdict"] not in ("pass", "fail")
        or not isinstance(result["reason"], str)
        or not result["reason"].strip()
        or len(result["reason"]) > 4000
    ):
        raise ValueError("The security model returned an invalid verdict")
    return result


def scan(*, bundle: bytes) -> dict[str, str]:
    from security_scan import write_summary

    with anthropic.Anthropic(timeout=TIMEOUT_SECONDS, max_retries=0) as client:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": VERDICT_SCHEMA},
            },
            system=(FACTORY_DIR / "security_scan_prompt.md").read_text(),
            messages=[{"role": "user", "content": bundle.decode("utf-8")}],
        )
    write_summary(
        f"Security scan {response.id}: model={MODEL}, effort={EFFORT}, "
        f"input_tokens={response.usage.input_tokens}, "
        f"output_tokens={response.usage.output_tokens}, stop_reason={response.stop_reason}"
    )
    if response.stop_reason != "end_turn":
        raise ValueError(
            f"The security model stopped before completing its scan ({response.stop_reason})"
        )
    if any(
        block.type not in ("text", "thinking", "redacted_thinking") for block in response.content
    ):
        raise ValueError("The security model returned unexpected content")
    texts = [block.text for block in response.content if block.type == "text"]
    if len(texts) != 1:
        raise ValueError("The security model did not return one verdict")
    return parse_verdict(texts[0])
