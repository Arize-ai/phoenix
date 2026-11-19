import base64
import hashlib
import zipfile
from pathlib import Path

import pytest
from check_wheel_contents.__main__ import main as check_wheel_contents
from click.testing import CliRunner

REPO_ROOT = Path(__file__).resolve().parents[2]


def _record_hash(data: bytes) -> str:
    digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode()
    return f"sha256={digest}"


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


def test_publish_wheel_check_skips_only_duplicate_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Identical files pass the publish check; the other checks still run."""
    wheel_path = _write_wheel(
        directory=tmp_path,
        files={
            "phoenix/__init__.py": b"",
            "phoenix/first_skill/SKILL.md": b"same skill\n",
            "phoenix/second_skill/SKILL.md": b"same skill\n",
            "phoenix/module.pyc": b"bytecode",
        },
    )
    # publish.yaml runs check-wheel-contents from the repo root, where it reads pyproject.toml.
    monkeypatch.chdir(REPO_ROOT)
    result = CliRunner().invoke(check_wheel_contents, ["--ignore", "W004", str(wheel_path)])
    assert "W002:" not in result.output
    assert "W001:" in result.output
