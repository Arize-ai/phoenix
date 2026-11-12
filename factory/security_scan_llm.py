import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Sequence

import anthropic

FACTORY_DIR = Path(__file__).resolve().parent
MODEL = "claude-opus-5-5"
EFFORT = "medium"
MAX_TOKENS = 8192
TIMEOUT_SECONDS = 300
MAX_IMAGES = 20
MAX_IMAGE_BYTES = 7 * 1024 * 1024
MAX_TOTAL_IMAGE_BYTES = 16 * 1024 * 1024
VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "reason"],
    "additionalProperties": False,
}


@dataclass(frozen=True)
class ScanImage:
    path: str
    revision: Literal["before", "after"]
    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
    blob_oid: str
    data: bytes

    def metadata(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "revision": self.revision,
            "media_type": self.media_type,
            "blob_oid": self.blob_oid,
            "size_bytes": len(self.data),
        }


def validate_images(images: Sequence[ScanImage]) -> None:
    if len(images) > MAX_IMAGES:
        raise ValueError("too-large-to-scan: more than 20 image versions")
    if any(len(image.data) > MAX_IMAGE_BYTES for image in images):
        raise ValueError("too-large-to-scan: image exceeds 7 MiB")
    if sum(len(image.data) for image in images) > MAX_TOTAL_IMAGE_BYTES:
        raise ValueError("too-large-to-scan: image content exceeds 16 MiB")


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


def scan(*, bundle: bytes, images: Sequence[ScanImage] = ()) -> dict[str, str]:
    from security_scan import write_summary

    validate_images(images)
    content: Any = bundle.decode("utf-8")
    if images:
        content = []
        for image in images:
            content.extend(
                [
                    {"type": "text", "text": "Untrusted image: " + json.dumps(image.metadata())},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image.media_type,
                            "data": base64.b64encode(image.data).decode("ascii"),
                        },
                    },
                ]
            )
        content.append({"type": "text", "text": bundle.decode("utf-8")})
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
            messages=[{"role": "user", "content": content}],
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
