#!/usr/bin/env python3
"""Run configured Phoenix integration documentation examples.

Each entry in ``integrations.json`` describes a documentation page, its
language, the code sections to assemble, required credentials, and its
verification criteria. The harness parses every selected page before checking
credentials, runs examples in disposable environments, verifies their result
against Phoenix, and writes aggregate JSON and Markdown reports.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = Path(__file__).with_name("integrations.json")
DEFAULT_ENDPOINT = "http://127.0.0.1:6006"
FENCE = re.compile(r"^```(?P<language>[\w+-]+)[^\n]*\n(?P<body>[\s\S]*?)^```", re.MULTILINE)
IMPORT = re.compile(
    r'^import\s+(?P<name>[A-Za-z_]\w*)\s+from\s+["\'](?P<path>[^"\']+)["\'];?',
    re.MULTILINE,
)
JSX_COMPONENT = re.compile(r"<(?P<name>[A-Za-z_]\w*)\b(?P<props>[^>]*)/?>", re.DOTALL)
JSX_ATTRIBUTE = re.compile(r"(?P<name>[A-Za-z_]\w*)=[\"'](?P<value>[^\"']*)[\"']")
EMBEDDED_CODE = re.compile(
    r'<CodeBlock\s+language=["\'](?P<language>[\w+-]+)["\'][^>]*>\s*'
    r"\{`(?P<body>[\s\S]*?)`\}\s*</CodeBlock>",
    re.MULTILINE,
)
PIP_COMMAND = re.compile(r"(?:^|\s)(?:python\s+-m\s+)?pip3?\s+install\b(?P<args>.*)$")


class HarnessError(RuntimeError):
    """An integration page or harness configuration cannot be executed."""


@dataclass(frozen=True)
class IntegrationSpec:
    id: str
    document: Path
    language: str
    install_section: str
    run_section: str
    required_env: tuple[str, ...]
    python_version: str
    setup: dict[str, str]
    output: dict[str, Any]
    verification: dict[str, Any]


def load_specs(config_path: Path = CONFIG_PATH) -> list[IntegrationSpec]:
    """Load and validate configured examples, keeping paths inside this repo."""
    try:
        config = json.loads(config_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"Could not read integration config {config_path}: {exc}") from exc
    if config.get("schema_version") != 1 or not isinstance(config.get("integrations"), list):
        raise HarnessError(f"Unsupported integration config schema in {config_path}")
    if not config["integrations"]:
        raise HarnessError(f"No integration docs are enabled in {config_path}")

    specs: list[IntegrationSpec] = []
    seen_ids: set[str] = set()
    seen_documents: set[Path] = set()
    for raw in config["integrations"]:
        try:
            relative = Path(raw["document"])
            document = (REPO_ROOT / relative).resolve()
            document.relative_to(REPO_ROOT)
            integration_id = str(raw["id"])
            language = str(raw["language"]).lower()
            if integration_id in seen_ids or document in seen_documents:
                raise HarnessError(f"Duplicate integration id or document: {integration_id}")
            if language != "python":
                raise HarnessError(
                    f"Integration {integration_id} uses unsupported language {language!r}; "
                    "add a language runner before registering it"
                )
            setup = raw["setup"]
            verification = raw["verification"]
            if setup.get("source") != "referenced_components":
                raise HarnessError(
                    f"Integration {integration_id} has unsupported setup source "
                    f"{setup.get('source')!r}"
                )
            if setup.get("language", "python").lower() != "python":
                raise HarnessError(f"Integration {integration_id} setup language must be Python")
            if verification.get("kind") != "phoenix_spans":
                raise HarnessError(
                    f"Integration {integration_id} has unsupported verifier "
                    f"{verification.get('kind')!r}"
                )
            if not document.is_file():
                raise HarnessError(f"Integration document does not exist: {relative}")
            specs.append(
                IntegrationSpec(
                    id=integration_id,
                    document=document,
                    language=language,
                    install_section=str(raw["install_section"]),
                    run_section=str(raw["run_section"]),
                    required_env=tuple(raw.get("required_env", [])),
                    python_version=str(raw.get("python_version", "3.11")),
                    setup={str(key): str(value) for key, value in setup.items()},
                    output=dict(raw.get("output", {})),
                    verification=dict(verification),
                )
            )
            seen_ids.add(integration_id)
            seen_documents.add(document)
        except (KeyError, TypeError, ValueError) as exc:
            raise HarnessError(f"Invalid integration config entry {raw!r}: {exc}") from exc
    return specs


def section_body(document_text: str, heading: str) -> str:
    """Return the body under a level-two Markdown heading."""
    pattern = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.MULTILINE)
    match = pattern.search(document_text)
    if not match:
        raise HarnessError(f"Missing '## {heading}' section")
    next_heading = re.search(r"^##\s+", document_text[match.end() :], re.MULTILINE)
    end = match.end() + next_heading.start() if next_heading else len(document_text)
    return document_text[match.end() : end]


def python_fence(section: str, context: str) -> str:
    for block in FENCE.finditer(section):
        if block.group("language").lower() == "python":
            return block.group("body").strip()
    raise HarnessError(f"No Python code block found in {context}")


def package_names(section: str) -> list[str]:
    """Read pip install requirements without executing commands from the page."""
    normalized = section.replace("\\\r\n", " ").replace("\\\n", " ")
    packages: list[str] = []
    for line in normalized.splitlines():
        command = line.strip()
        if not command or command.startswith("#"):
            continue
        match = PIP_COMMAND.search(command)
        if not match:
            continue
        for token in shlex.split(match.group("args")):
            if token.startswith("-"):
                continue
            # Index URLs and editable paths are not package names; requiring
            # explicit future adapters is safer than executing shell syntax.
            if token.startswith(("http://", "https://", "git+", ".", "/")):
                raise HarnessError(f"Unsupported pip requirement in docs install block: {token}")
            packages.append(token)
    unique = list(dict.fromkeys(packages))
    if not unique:
        raise HarnessError("Install section must contain a pip install command")
    return unique


def component_setup(spec: IntegrationSpec, document_text: str) -> str:
    """Resolve Python setup snippets imported and rendered by the MDX page."""
    imported = {
        match.group("name"): match.group("path") for match in IMPORT.finditer(document_text)
    }
    snippets: list[str] = []
    for component in JSX_COMPONENT.finditer(document_text):
        name = component.group("name")
        if name not in imported:
            continue
        component_path = (spec.document.parent / imported[name]).resolve()
        try:
            component_path.relative_to(REPO_ROOT)
            component_text = component_path.read_text()
        except (ValueError, OSError) as exc:
            raise HarnessError(
                f"Could not resolve imported MDX component {imported[name]}: {exc}"
            ) from exc

        props = {
            item.group("name"): item.group("value")
            for item in JSX_ATTRIBUTE.finditer(component.group("props"))
        }
        for block in EMBEDDED_CODE.finditer(component_text):
            if block.group("language").lower() != spec.setup.get("language", "python").lower():
                continue
            snippet = block.group("body")
            for prop, value in props.items():
                snippet = snippet.replace("${" + prop + "}", value)
            snippets.append(snippet.strip())
    if not snippets:
        raise HarnessError("No Python setup snippet was found in imported MDX components")
    return "\n\n".join(snippets)


def extract_example(spec: IntegrationSpec) -> tuple[list[str], str]:
    text = spec.document.read_text()
    packages = package_names(section_body(text, spec.install_section))
    setup = component_setup(spec, text)
    run = python_fence(section_body(text, spec.run_section), f"## {spec.run_section}")
    flush_code = spec.setup.get("flush_code", "").strip()
    sections = [setup, run]
    if flush_code:
        sections.append(flush_code)
    return packages, "\n\n".join(sections)


def request_json(url: str, api_key: str | None) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.loads(response.read())
    if not isinstance(payload, dict):
        raise HarnessError(f"Expected a JSON object from {url}")
    return payload


def verify_phoenix_spans(
    spec: IntegrationSpec,
    endpoint: str,
    api_key: str | None,
    start_time: datetime,
    project: str,
) -> dict[str, Any]:
    """Poll the Phoenix spans API until a span satisfies the configured rules."""
    project_path = urllib.parse.quote(project, safe="")
    query = urllib.parse.urlencode(
        {
            "start_time": start_time.isoformat(),
            "limit": "100",
            "sort": "start_time",
            "order": "desc",
        }
    )
    url = f"{endpoint.rstrip('/')}/v1/projects/{project_path}/spans?{query}"
    rules = spec.verification
    required_kind = str(rules.get("span_kind", ""))
    required_attributes = tuple(rules.get("required_attributes", []))
    non_empty_attributes = tuple(rules.get("non_empty_attributes", []))
    expected_attributes = dict(rules.get("attributes", {}))
    deadline = time.monotonic() + float(rules.get("timeout_seconds", 45))
    last_error = "No matching span found yet"
    while time.monotonic() < deadline:
        try:
            payload = request_json(url, api_key)
            spans = payload.get("data", [])
            if not isinstance(spans, list):
                raise HarnessError("Phoenix spans response did not contain a data list")
            for span in spans:
                attrs = span.get("attributes", {})
                if required_kind and span.get("span_kind") != required_kind:
                    continue
                if not all(key in attrs for key in required_attributes):
                    continue
                if not all(attrs.get(key) for key in non_empty_attributes):
                    continue
                if any(attrs.get(key) != value for key, value in expected_attributes.items()):
                    continue
                return span
        except HarnessError:
            raise
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = str(exc)
        time.sleep(2)
    raise HarnessError(f"Timed out waiting for a matching Phoenix span: {last_error}")


def validate_output(spec: IntegrationSpec, stdout: str) -> None:
    if spec.output.get("require_non_empty") and not stdout.strip():
        raise HarnessError("Documented example produced no response text")
    required = spec.output.get("contains", [])
    missing = [value for value in required if value not in stdout]
    if missing:
        raise HarnessError(f"Example output did not contain required text: {missing!r}")
    patterns = spec.output.get("regex", [])
    invalid = [pattern for pattern in patterns if re.search(pattern, stdout, re.MULTILINE) is None]
    if invalid:
        raise HarnessError(f"Example output did not match required patterns: {invalid!r}")


def python_executable(venv: Path) -> Path:
    return venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run_example(
    spec: IntegrationSpec,
    packages: list[str],
    program: str,
    endpoint: str,
    project: str,
) -> str:
    uv = shutil.which("uv")
    if uv is None:
        raise HarnessError("uv is required to create an isolated environment for the example")
    with tempfile.TemporaryDirectory(prefix=f"phoenix-doc-{spec.id}-") as temp_dir:
        temp = Path(temp_dir)
        venv = temp / ".venv"
        subprocess.run(
            [uv, "venv", "--seed", "--python", spec.python_version, str(venv)],
            check=True,
            cwd=REPO_ROOT,
        )
        subprocess.run(
            [uv, "pip", "install", "--python", str(python_executable(venv)), *packages],
            check=True,
            cwd=temp,
        )
        sample = temp / "example.py"
        sample.write_text(program)
        env = os.environ.copy()
        env["PHOENIX_COLLECTOR_ENDPOINT"] = endpoint
        env["PHOENIX_PROJECT_NAME"] = project
        completed = subprocess.run(
            [str(python_executable(venv)), str(sample)],
            check=True,
            capture_output=True,
            text=True,
            timeout=180,
            env=env,
            cwd=temp,
        )
        return completed.stdout


def check_health(endpoint: str) -> None:
    request = urllib.request.Request(f"{endpoint.rstrip('/')}/healthz")
    with urllib.request.urlopen(request, timeout=10) as response:
        if response.status != 200:
            raise HarnessError(f"Phoenix health check returned HTTP {response.status}")


def project_name(spec: IntegrationSpec) -> str:
    suffix = os.environ.get("GITHUB_RUN_ID") or str(time.time_ns())
    attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "local")
    return f"integration-docs-{spec.id}-{suffix}-{attempt}"


def run_one(spec: IntegrationSpec, endpoint: str) -> dict[str, Any]:
    started = datetime.now(timezone.utc)
    project = project_name(spec)
    result: dict[str, Any] = {
        "id": spec.id,
        "document": str(spec.document.relative_to(REPO_ROOT)),
        "language": spec.language,
        "started_at": started.isoformat(),
        "phoenix_endpoint": endpoint,
        "project": project,
        "status": "fail",
    }
    try:
        packages, program = extract_example(spec)
        result["packages"] = packages
    except (HarnessError, OSError) as exc:
        result.update(status="fail", error=str(exc))
        result["ended_at"] = datetime.now(timezone.utc).isoformat()
        return result

    missing = [name for name in spec.required_env if not os.environ.get(name)]
    if missing:
        result.update(
            status="skipped",
            reason=f"Missing required environment variable(s): {', '.join(missing)}",
            ended_at=datetime.now(timezone.utc).isoformat(),
        )
        return result

    try:
        check_health(endpoint)
        stdout = run_example(spec, packages, program, endpoint, project)
        result["stdout"] = stdout.strip()
        validate_output(spec, stdout)
        span = verify_phoenix_spans(
            spec,
            endpoint,
            os.environ.get("PHOENIX_API_KEY"),
            started,
            project,
        )
        result.update(status="pass", span=span)
    except (
        HarnessError,
        OSError,
        subprocess.CalledProcessError,
        subprocess.TimeoutExpired,
    ) as exc:
        result["error"] = str(exc)
        if isinstance(exc, subprocess.CalledProcessError):
            result.update(
                command=exc.cmd,
                returncode=exc.returncode,
                stdout=exc.stdout,
                stderr=exc.stderr,
            )
    result["ended_at"] = datetime.now(timezone.utc).isoformat()
    return result


def summarize(records: list[dict[str, Any]], started: datetime) -> dict[str, Any]:
    statuses = {record["status"] for record in records}
    if "fail" in statuses:
        status = "fail"
    elif statuses == {"skipped"}:
        status = "skipped"
    else:
        status = "pass"
    return {
        "schema_version": 1,
        "started_at": started.isoformat(),
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "counts": {
            name: sum(record["status"] == name for record in records)
            for name in ("pass", "fail", "skipped")
        },
        "integrations": records,
    }


def write_report(output_dir: Path, summary: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "integration-docs.json").write_text(json.dumps(summary, indent=2) + "\n")
    lines = [
        "# Integration documentation checks",
        "",
        f"Overall status: **{summary['status']}**",
        "",
        "| Integration | Document | Language | Status | Result |",
        "|---|---|---|---|---|",
    ]
    for record in summary["integrations"]:
        span = record.get("span", {})
        result = record.get("reason") or record.get("error")
        if span:
            result = f"{span.get('span_kind')} span `{span.get('name')}`"
            model = span.get("attributes", {}).get("llm.model_name")
            if model:
                result += f"; model `{model}`"
        result = str(result or "—").replace("|", "\\|").replace("\n", " ")
        lines.append(
            f"| `{record['id']}` | `{record['document']}` | {record['language']} "
            f"| **{record['status']}** | {result} |"
        )
    lines.append("")
    (output_dir / "integration-docs.md").write_text("\n".join(lines))


def select_specs(specs: list[IntegrationSpec], document: str | None) -> list[IntegrationSpec]:
    if document is None:
        return specs
    normalized = Path(document)
    if normalized.is_absolute():
        try:
            normalized = normalized.resolve().relative_to(REPO_ROOT)
        except ValueError as exc:
            raise HarnessError(f"Document {document!r} is outside the repository") from exc
    selected = [spec for spec in specs if spec.document.relative_to(REPO_ROOT) == normalized]
    if not selected:
        choices = ", ".join(str(spec.document.relative_to(REPO_ROOT)) for spec in specs)
        raise HarnessError(
            f"Document {document!r} is not enabled in integrations.json. "
            f"Configured documents: {choices}"
        )
    return selected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--doc", help="Run one configured integration document")
    selection.add_argument("--list", action="store_true", help="List configured documents")
    parser.add_argument("--endpoint", default=os.environ.get("PHOENIX_ENDPOINT", DEFAULT_ENDPOINT))
    parser.add_argument(
        "--output-dir", type=Path, default=REPO_ROOT / "ci-results/integration-docs"
    )
    args = parser.parse_args()
    try:
        specs = select_specs(load_specs(), args.doc)
        if args.list:
            for spec in specs:
                print(f"{spec.id}\t{spec.document.relative_to(REPO_ROOT)}\t{spec.language}")
            return 0
        start = datetime.now(timezone.utc)
        records = [run_one(spec, args.endpoint) for spec in specs]
        summary = summarize(records, start)
        write_report(args.output_dir, summary)
        print((args.output_dir / "integration-docs.md").read_text())
        return 1 if summary["status"] == "fail" else 0
    except HarnessError as exc:
        print(f"integration-docs: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
