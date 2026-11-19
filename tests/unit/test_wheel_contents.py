import base64
import hashlib
import zipfile
from pathlib import Path

import pytest
from check_wheel_contents.__main__ import main as check_wheel_contents
from click.testing import CliRunner

REPO_ROOT = Path(__file__).resolve().parents[2]
# Wheel artifacts in pyproject.toml that hold the skills PXI and the MCP server load.
SKILL_ARTIFACTS = (
    "src/phoenix/server/agents/prompts",
    "src/phoenix/server/mcp/skills",
)


def _record_hash(data: bytes) -> str:
    digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode()
    return f"sha256={digest}"


def _build_skills_wheel(path: Path) -> Path:
    """A wheel holding the skill files the arize-phoenix wheel ships, at the same paths."""
    wheel = path / "arize_phoenix-0-py3-none-any.whl"
    dist_info = "arize_phoenix-0.dist-info"
    records = []
    with zipfile.ZipFile(wheel, "w") as zf:

        def add(arcname: str, data: bytes) -> None:
            zf.writestr(arcname, data)
            records.append(f"{arcname},{_record_hash(data)},{len(data)}")

        for artifact in SKILL_ARTIFACTS:
            for file in sorted((REPO_ROOT / artifact).rglob("*")):
                if file.is_file() and "__pycache__" not in file.parts:
                    add(file.relative_to(REPO_ROOT / "src").as_posix(), file.read_bytes())
        add(f"{dist_info}/METADATA", b"Metadata-Version: 2.1\nName: arize-phoenix\nVersion: 0\n")
        add(f"{dist_info}/WHEEL", b"Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n")
        zf.writestr(f"{dist_info}/RECORD", "\n".join([*records, f"{dist_info}/RECORD,,"]) + "\n")
    return wheel


def test_skill_files_pass_publish_wheel_check(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The publish workflow runs `check-wheel-contents --ignore W004` from the repo root."""
    wheel = _build_skills_wheel(tmp_path)
    monkeypatch.chdir(REPO_ROOT)  # so check-wheel-contents reads ./pyproject.toml as in CI
    result = CliRunner().invoke(check_wheel_contents, ["--ignore", "W004", str(wheel)])
    assert result.exit_code == 0, result.output


def _write_wheel(*, directory: Path, files: dict[str, bytes]) -> Path:
    wheel_path = directory / "arize_phoenix-0-py3-none-any.whl"
    dist_info = "arize_phoenix-0.dist-info"
    entries = {
        **files,
        f"{dist_info}/METADATA": b"Metadata-Version: 2.1\nName: arize-phoenix\nVersion: 0\n",
        f"{dist_info}/WHEEL": b"Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
    }
    records = [f"{name},{_record_hash(data)},{len(data)}" for name, data in entries.items()]
    with zipfile.ZipFile(wheel_path, "w") as wheel_file:
        for name, data in entries.items():
            wheel_file.writestr(name, data)
        wheel_file.writestr(
            f"{dist_info}/RECORD", "\n".join([*records, f"{dist_info}/RECORD,,"]) + "\n"
        )
    return wheel_path


@pytest.mark.parametrize(
    "files, expected_failure",
    [
        pytest.param(
            {
                "phoenix/__init__.py": b"",
                "phoenix/a/SKILL.md": b"same skill\n",
                "phoenix/b/SKILL.md": b"same skill\n",
            },
            None,
            id="duplicate-files-allowed",
        ),
        pytest.param(
            {"phoenix/__init__.py": b"", "phoenix/module.pyc": b"bytecode"},
            "W001",
            id="other-checks-still-run",
        ),
    ],
)
def test_publish_wheel_check_allows_only_duplicate_files(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    files: dict[str, bytes],
    expected_failure: str | None,
) -> None:
    wheel_path = _write_wheel(directory=tmp_path, files=files)
    monkeypatch.chdir(REPO_ROOT)
    result = CliRunner().invoke(check_wheel_contents, ["--ignore", "W004", str(wheel_path)])
    if expected_failure is None:
        assert result.exit_code == 0, result.output
    else:
        assert result.exit_code != 0
        assert f"{expected_failure}:" in result.output
