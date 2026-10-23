#!/usr/bin/env python3
"""Run and verify the Python OpenAI SDK example from the Phoenix docs.

This first integration-doc runner intentionally targets one page. It extracts
the install, shared tracer setup component, and run example from the published
MDX page, runs them in a temporary virtual environment, then checks the local
Phoenix spans API for an LLM span created during this invocation.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
DOC_PATH = REPO_ROOT / "docs/phoenix/integrations/llm-providers/openai/openai-tracing.mdx"
DEFAULT_ENDPOINT = "http://127.0.0.1:6006"
PROJECT_NAME = os.environ.get("PHOENIX_TEST_PROJECT_NAME") or (
    f"integration-docs-openai-python-{os.environ.get('GITHUB_RUN_ID') or time.time_ns()}"
    f"-{os.environ.get('GITHUB_RUN_ATTEMPT', 'local')}"
)
INSTALL_SECTION = re.compile(r"^## Install\s*$([\s\S]*?)(?=^## )", re.MULTILINE)
RUN_SECTION = re.compile(r"^## Run OpenAI\s*$([\s\S]*?)(?=^## )", re.MULTILINE)
FENCE = re.compile(r"^```(?P<lang>[\w+-]+)[^\n]*\n(?P<body>[\s\S]*?)^```", re.MULTILINE)
SETUP_IMPORT = re.compile(r'^import RegisterTracerPython from "([^"]+)";', re.MULTILINE)
SETUP_CODE = re.compile(
    r'<CodeBlock language="python">\s*\{`(?P<body>[\s\S]*?)`\}\s*</CodeBlock>',
    re.MULTILINE,
)


class HarnessError(RuntimeError):
    pass


def read_code_section(text: str, section: re.Pattern[str], name: str) -> str:
    match = section.search(text)
    if not match:
        relative_doc = DOC_PATH.relative_to(REPO_ROOT)
        raise HarnessError(f"Could not find the {name} section in {relative_doc}")
    for block in FENCE.finditer(match.group(1)):
        if block.group("lang").lower() in {"python", "bash", "sh", "shell"}:
            return block.group("body").strip()
    raise HarnessError(f"No supported code block found in {name}")


def extract_example() -> tuple[list[str], str]:
    text = DOC_PATH.read_text()
    install = read_code_section(text, INSTALL_SECTION, "Install")
    install_commands = [
        line.strip().removesuffix("\\").strip()
        for line in install.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    packages: list[str] = []
    for command in install_commands:
        tokens = shlex.split(command)
        if len(tokens) >= 2 and Path(tokens[0]).name in {"pip", "pip3"} and tokens[1] == "install":
            packages.extend(token for token in tokens[2:] if not token.startswith("-"))
    if not packages:
        raise HarnessError("Install section must contain a pip install command")

    import_match = SETUP_IMPORT.search(text)
    if not import_match:
        raise HarnessError("Could not find the shared RegisterTracerPython import")
    setup_path = (DOC_PATH.parent / import_match.group(1)).resolve()
    try:
        setup_text = setup_path.read_text()
    except OSError as exc:
        raise HarnessError(f"Could not read shared setup component {setup_path}: {exc}") from exc
    setup_match = SETUP_CODE.search(setup_text)
    if not setup_match:
        raise HarnessError(f"Could not extract Python setup code from {setup_path}")
    setup = setup_match.group("body").replace("${projectName}", PROJECT_NAME)
    run_code = read_code_section(text, RUN_SECTION, "Run OpenAI")
    if "tracer_provider" not in setup:
        raise HarnessError(
            "Shared setup must assign the Phoenix tracer provider to tracer_provider"
        )

    # The page uses a batch exporter; force a flush before the sample process exits.
    program = "\n\n".join((setup, run_code, "tracer_provider.force_flush(timeout_millis=10000)"))
    return packages, program


def request_json(url: str, api_key: str | None) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read())


def wait_for_llm_span(endpoint: str, api_key: str | None, start_time: datetime) -> dict[str, Any]:
    project = urllib.parse.quote(PROJECT_NAME, safe="")
    start = urllib.parse.quote(start_time.isoformat(), safe="")
    url = (
        f"{endpoint.rstrip('/')}/v1/projects/{project}/spans?start_time={start}"
        "&limit=100&sort=start_time&order=desc"
    )
    deadline = time.monotonic() + 45
    last_error: str | None = None
    while time.monotonic() < deadline:
        try:
            payload = request_json(url, api_key)
            for span in payload.get("data", []):
                attrs = span.get("attributes", {})
                if span.get("span_kind") == "LLM" and attrs.get("llm.model_name"):
                    return span
            last_error = "No LLM span with llm.model_name found yet"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = str(exc)
        time.sleep(2)
    raise HarnessError(f"Timed out waiting for an OpenAI LLM span: {last_error}")


def write_reports(output_dir: Path, result: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "openai-python-integration.json").write_text(json.dumps(result, indent=2) + "\n")
    lines = [
        "# Python OpenAI integration doc check",
        "",
        f"- **Status:** {result['status']}",
        f"- **Document:** `{result['document']}`",
        f"- **Phoenix endpoint:** `{result['phoenix_endpoint']}`",
        f"- **Project:** `{result['project']}`",
    ]
    if result.get("span"):
        lines.extend(
            [
                f"- **Span:** `{result['span']['name']}` ({result['span']['span_kind']})",
                f"- **Model:** `{result['span']['attributes'].get('llm.model_name', 'unknown')}`",
            ]
        )
    if result.get("error"):
        lines.extend(["", f"**Error:** {result['error']}"])
    (output_dir / "openai-python-integration.md").write_text("\n".join(lines) + "\n")


def run(output_dir: Path, endpoint: str) -> int:
    started = datetime.now(timezone.utc)
    result: dict[str, Any] = {
        "schema_version": 1,
        "document": str(DOC_PATH.relative_to(REPO_ROOT)),
        "started_at": started.isoformat(),
        "phoenix_endpoint": endpoint,
        "project": PROJECT_NAME,
        "status": "fail",
    }
    try:
        packages, program = extract_example()
        result["packages"] = packages
    except HarnessError as exc:
        result.update(status="fail", error=str(exc))
        result["ended_at"] = datetime.now(timezone.utc).isoformat()
        write_reports(output_dir, result)
        print((output_dir / "openai-python-integration.md").read_text())
        return 1

    if not os.environ.get("OPENAI_API_KEY"):
        result.update(
            status="skipped",
            error="OPENAI_API_KEY is not configured; page structure was parsed successfully",
            ended_at=datetime.now(timezone.utc).isoformat(),
        )
        write_reports(output_dir, result)
        print((output_dir / "openai-python-integration.md").read_text())
        return 0

    try:
        health_request = urllib.request.Request(f"{endpoint.rstrip('/')}/healthz")
        with urllib.request.urlopen(health_request, timeout=10) as response:
            if response.status != 200:
                raise HarnessError(f"Phoenix health check returned HTTP {response.status}")
        with tempfile.TemporaryDirectory(prefix="phoenix-openai-doc-") as temp_dir:
            temp = Path(temp_dir)
            venv = temp / ".venv"
            subprocess.run(
                ["uv", "venv", "--seed", "--python", "3.11", str(venv)],
                check=True,
                cwd=REPO_ROOT,
            )
            # The shared Phoenix setup component imports phoenix.otel. Install its
            # published package alongside the dependencies declared in the page.
            packages = list(dict.fromkeys([*packages, "arize-phoenix-otel"]))
            subprocess.run(
                ["uv", "pip", "install", "--python", str(venv / "bin/python"), *packages],
                check=True,
                cwd=temp,
            )
            sample = temp / "openai_example.py"
            sample.write_text(program)
            env = os.environ.copy()
            env["PHOENIX_COLLECTOR_ENDPOINT"] = endpoint
            env["PHOENIX_PROJECT_NAME"] = PROJECT_NAME
            completed = subprocess.run(
                [str(venv / "bin/python"), str(sample)],
                check=True,
                capture_output=True,
                text=True,
                timeout=180,
                env=env,
                cwd=temp,
            )
            result["stdout"] = completed.stdout.strip()
            if not result["stdout"]:
                raise HarnessError("The documented OpenAI example produced no response text")
        span = wait_for_llm_span(endpoint, os.environ.get("PHOENIX_API_KEY"), started)
        result.update(status="pass", span=span)
    except (HarnessError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        result["error"] = str(exc)
        if isinstance(exc, subprocess.CalledProcessError):
            result["command"] = exc.cmd
            result["returncode"] = exc.returncode
            result["stdout"] = exc.stdout
            result["stderr"] = exc.stderr
    result["ended_at"] = datetime.now(timezone.utc).isoformat()
    write_reports(output_dir, result)
    print((output_dir / "openai-python-integration.md").read_text())
    return 0 if result["status"] in {"pass", "skipped"} else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", default=os.environ.get("PHOENIX_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument(
        "--output-dir", type=Path, default=REPO_ROOT / "ci-results/integration-docs"
    )
    args = parser.parse_args()
    return run(args.output_dir, args.endpoint)


if __name__ == "__main__":
    sys.exit(main())
