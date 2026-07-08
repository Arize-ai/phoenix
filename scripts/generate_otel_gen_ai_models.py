# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "datamodel-code-generator[http,ruff]==0.57.0",
# ]
# ///
"""Regenerate the OTel GenAI semconv Pydantic models at OUTPUT_PATH.

Run via ``make gen-otel-models``. To bump the semconv version, edit
``SEMCONV_VERSION`` below.

The five upstream schemas are merged into one combined JSON Schema (shared
``$defs`` like ``BlobPart`` are deduplicated, and a root ``$def`` is added per
schema), then datamodel-codegen emits a single Pydantic v2 module.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

# Pinned commit on open-telemetry/semantic-conventions-genai. The schemas live in
# their own repo as of late 2026 — the parent ``semantic-conventions`` repo's last
# v1.41.1 snapshot is byte-identical, but the carved-out repo doesn't tag releases
# yet, so we pin a specific SHA for reproducible codegen.
SEMCONV_REF = "494d44d5bcc9"
OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent
    / "src"
    / "phoenix"
    / "trace"
    / "gen_ai"
    / "__generated__"
    / "models.py"
)

# (schema filename, top-level Pydantic class name). Order is preserved end-to-end
# so reruns produce byte-identical output for clean diffs.
SCHEMA_ROOTS: tuple[tuple[str, str], ...] = (
    ("gen-ai-input-messages.json", "InputMessages"),
    ("gen-ai-output-messages.json", "OutputMessages"),
    ("gen-ai-retrieval-documents.json", "RetrievalDocuments"),
    ("gen-ai-system-instructions.json", "SystemInstructions"),
    ("gen-ai-tool-definitions.json", "ToolDefinitions"),
)
SOURCE_URL = (
    "https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/"
    "{ref}/docs/gen-ai/{filename}"
)

# OTel's tool-definition schema refs http://json-schema.org/draft-07/schema# for the
# free-form FunctionToolDefinition.parameters field. Pulling the metaschema in
# produces a recursive ``Schema`` class whose ``Schema | bool`` field defaults
# fail mypy --strict, so we rewrite those refs into a generic JSON object.
JSONSCHEMA_METASCHEMA_URL = "http://json-schema.org/draft-07/schema"


def fetch_schemas(dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for filename, _ in SCHEMA_ROOTS:
        url = SOURCE_URL.format(ref=SEMCONV_REF, filename=filename)
        print(f"  fetching {url}", file=sys.stderr)
        with urllib.request.urlopen(url) as response:  # noqa: S310
            (dest / filename).write_bytes(response.read())


def inline_metaschema_refs(node: Any) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.split("#", 1)[0] == JSONSCHEMA_METASCHEMA_URL:
            del node["$ref"]
            node["type"] = "object"
            node["additionalProperties"] = True
        for value in node.values():
            inline_metaschema_refs(value)
    elif isinstance(node, list):
        for item in node:
            inline_metaschema_refs(item)


def build_combined_schema(schemas_dir: Path) -> dict[str, Any]:
    defs: dict[str, Any] = {}
    for filename, root_name in SCHEMA_ROOTS:
        schema = json.loads((schemas_dir / filename).read_text())
        inline_metaschema_refs(schema)
        for name, body in schema.get("$defs", {}).items():
            if name in defs and defs[name] != body:
                raise RuntimeError(f"conflicting $defs for {name!r} between schemas")
            defs[name] = body
        if root_name in defs:
            raise RuntimeError(f"root name {root_name!r} collides with a $def")
        defs[root_name] = {k: v for k, v in schema.items() if k != "$defs"}
    return {"$defs": defs}


# Drops datamodel-codegen's banner (which contains a non-deterministic timestamp).
_BANNER_RE = re.compile(r"\A(?:#[^\n]*\n)+\n*")
# Drops the empty ``class Model(RootModel[Any])`` wrapper datamodel-codegen emits
# for the synthesized top-level (we only use the $defs, not the root).
_EMPTY_ROOT_RE = re.compile(r"\nclass Model\(RootModel\[Any\]\):\n(?:    [^\n]*\n)+")


def rewrite_header(output_path: Path) -> None:
    body = _EMPTY_ROOT_RE.sub("\n", _BANNER_RE.sub("", output_path.read_text(), count=1))
    header = (
        f"# Auto-generated from open-telemetry/semantic-conventions-genai @ {SEMCONV_REF}\n"
        f"# Source schemas: {', '.join(name for name, _ in SCHEMA_ROOTS)}\n"
        "# Regenerate with: make gen-otel-models\n"
        "# DO NOT EDIT BY HAND.\n"
        "# ruff: noqa: E501\n\n"
    )
    output_path.write_text(header + body)


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        schemas_dir = Path(tmp) / "schemas"
        print(
            f"Downloading {len(SCHEMA_ROOTS)} schemas for semconv-genai @ {SEMCONV_REF}:",
            file=sys.stderr,
        )
        fetch_schemas(schemas_dir)

        combined_path = Path(tmp) / "combined.json"
        combined_path.write_text(json.dumps(build_combined_schema(schemas_dir), indent=2))

        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        print(f"  generating {OUTPUT_PATH}", file=sys.stderr)
        subprocess.run(
            [
                sys.executable,
                "-m",
                "datamodel_code_generator",
                "--input",
                str(combined_path),
                "--input-file-type",
                "jsonschema",
                "--output",
                str(OUTPUT_PATH),
                "--output-model-type",
                "pydantic_v2.BaseModel",
                "--target-python-version",
                "3.10",
                "--use-annotated",
                "--use-double-quotes",
                "--use-standard-collections",
                "--use-union-operator",
                "--use-schema-description",
                "--field-constraints",
                "--allow-remote-refs",
                "--formatters",
                "ruff-format",
                "ruff-check",
            ],
            check=True,
        )
        rewrite_header(OUTPUT_PATH)
        print(f"\nWrote {OUTPUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
