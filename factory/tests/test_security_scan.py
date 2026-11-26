import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

# The factory scripts run as standalone `uv run --script` files that import each other by
# module name, so put factory/ itself on the path rather than treating it as a package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import security_scan  # noqa: E402


def _semgrep_findings(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, errors: list[dict[str, Any]]
) -> tuple[list[security_scan.Finding], list[list[str]]]:
    commands: list[list[str]] = []

    def fake_run(cmd: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
        commands.append(cmd)
        if cmd[1:] == ["--version"]:
            return subprocess.CompletedProcess(cmd, 0, stdout=security_scan.SEMGREP_VERSION)
        return subprocess.CompletedProcess(
            cmd, 0, stdout=json.dumps({"results": [], "errors": errors})
        )

    monkeypatch.setattr(security_scan.subprocess, "run", fake_run)
    findings = security_scan.semgrep_findings(destination=tmp_path, paths=["a.py"], ranges={})
    return findings, commands


def test_semgrep_scan_does_not_use_strict(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _, commands = _semgrep_findings(monkeypatch, tmp_path, [])
    assert "--strict" not in commands[-1]


@pytest.mark.parametrize(
    "error_type",
    [
        "Syntax error",
        "Lexical error",
        "Other syntax error",
        "AST builder error",
        ["PartialParsing", [{"path": "a.py"}]],
    ],
)
def test_semgrep_parse_errors_are_not_fatal(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, error_type: Any
) -> None:
    errors = [{"type": error_type, "path": str(tmp_path / "a.py")}]
    findings, _ = _semgrep_findings(monkeypatch, tmp_path, errors)
    assert findings == [
        security_scan.Finding(
            "a.py",
            1,
            "semgrep-unparsed",
            "Semgrep could not parse this file; its Python rules did not run",
        )
    ]


def test_other_semgrep_errors_still_fail_and_name_the_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    errors = [{"type": "Timeout", "path": str(tmp_path / "a.py")}]
    with pytest.raises(ValueError, match=r"changed files: a\.py$"):
        _semgrep_findings(monkeypatch, tmp_path, errors)


def test_skip_reason_names_the_error_as_inert_code(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(**kwargs: Any) -> Any:
        raise ValueError("could not inspect: x`.py\n@someone **bold**")

    monkeypatch.setattr(security_scan, "read_thread", fail)
    problem = security_scan.find_admission_problem(number=1, kind="pr")
    assert problem == (
        "the security scan could not complete "
        "(`ValueError: could not inspect: x?.py?@someone **bold**`); "
        "see the workflow run, and retry only if this looks transient"
    )
