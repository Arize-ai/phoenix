"""Test helpers for comparison tests against real bash/commands."""

import asyncio
import hashlib
import json
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from just_bash import Bash


@dataclass
class CommandResult:
    """Result from running a command."""

    stdout: str
    stderr: str
    exit_code: int


@dataclass
class Fixture:
    """A recorded fixture for comparison."""

    command: str
    stdout: str
    stderr: str
    exit_code: int
    locked: bool = False


def get_fixture_path(test_file: str) -> Path:
    """Get the fixture file path for a test file."""
    test_name = Path(test_file).stem.replace("test_", "")
    return Path(__file__).parent / "fixtures" / f"{test_name}.fixtures.json"


def load_fixtures(test_file: str) -> dict[str, Fixture]:
    """Load fixtures from JSON file."""
    path = get_fixture_path(test_file)
    if not path.exists():
        return {}

    with open(path) as f:
        data = json.load(f)

    fixtures = {}
    for key, value in data.items():
        fixtures[key] = Fixture(
            command=value["command"],
            stdout=value["stdout"],
            stderr=value["stderr"],
            exit_code=value["exit_code"],
            locked=value.get("locked", False),
        )
    return fixtures


def save_fixtures(test_file: str, fixtures: dict[str, Fixture]) -> None:
    """Save fixtures to JSON file."""
    path = get_fixture_path(test_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    data = {}
    for key, fixture in fixtures.items():
        data[key] = {
            "command": fixture.command,
            "stdout": fixture.stdout,
            "stderr": fixture.stderr,
            "exit_code": fixture.exit_code,
            "locked": fixture.locked,
        }

    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def fixture_id(command: str) -> str:
    """Generate a fixture ID from command."""
    return hashlib.md5(command.encode()).hexdigest()[:12]


def run_real_command(command: str, cmd_name: str = "bash") -> CommandResult:
    """Run a command using the real system command."""
    import shlex

    try:
        if cmd_name == "sqlite3":
            # For sqlite3, parse the command properly to handle quotes
            # The command format is: sqlite3 [options] :memory: 'SQL'
            parts = shlex.split(command)
            # Skip 'sqlite3' from the parsed parts
            if parts and parts[0] == "sqlite3":
                parts = parts[1:]
            result = subprocess.run(
                ["sqlite3"] + parts,
                capture_output=True,
                text=True,
                timeout=30,
            )
        else:
            # For bash commands
            result = subprocess.run(
                [cmd_name, "-c", command],
                capture_output=True,
                text=True,
                timeout=30,
            )
        return CommandResult(
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return CommandResult(stdout="", stderr="Command timed out", exit_code=124)
    except FileNotFoundError:
        return CommandResult(
            stdout="", stderr=f"Command not found: {cmd_name}", exit_code=127
        )


async def run_just_bash(command: str) -> CommandResult:
    """Run a command using just-bash."""
    bash = Bash()
    result = await bash.exec(command)
    return CommandResult(
        stdout=result.stdout,
        stderr=result.stderr,
        exit_code=result.exit_code,
    )


class ComparisonTest:
    """Helper class for running comparison tests."""

    def __init__(self, test_file: str, cmd_name: str = "bash"):
        self.test_file = test_file
        self.cmd_name = cmd_name
        self.fixtures = load_fixtures(test_file)
        self.record_mode = os.environ.get("RECORD_FIXTURES", "").lower() in (
            "1",
            "true",
            "force",
        )
        self.force_mode = os.environ.get("RECORD_FIXTURES", "").lower() == "force"

    async def compare(
        self,
        command: str,
        normalize_whitespace: bool = False,
        compare_exit_code: bool = True,
    ) -> None:
        """Compare just-bash output against fixture or real command."""
        fid = fixture_id(command)

        if self.record_mode:
            # Record mode: run real command and save fixture
            if fid in self.fixtures and self.fixtures[fid].locked and not self.force_mode:
                print(f"Skipping locked fixture: {command}")
                return

            real_result = run_real_command(command, self.cmd_name)
            self.fixtures[fid] = Fixture(
                command=command,
                stdout=real_result.stdout,
                stderr=real_result.stderr,
                exit_code=real_result.exit_code,
            )
            save_fixtures(self.test_file, self.fixtures)
            return

        # Test mode: compare against fixture
        if fid not in self.fixtures:
            raise AssertionError(
                f"No fixture found for command: {command}\n"
                f"Run with RECORD_FIXTURES=1 to record fixtures."
            )

        fixture = self.fixtures[fid]
        just_bash_result = await run_just_bash(command)

        # Compare stdout
        expected_stdout = fixture.stdout
        actual_stdout = just_bash_result.stdout

        if normalize_whitespace:
            expected_stdout = " ".join(expected_stdout.split())
            actual_stdout = " ".join(actual_stdout.split())

        assert actual_stdout == expected_stdout, (
            f"stdout mismatch for: {command}\n"
            f"Expected: {repr(expected_stdout)}\n"
            f"Actual: {repr(actual_stdout)}"
        )

        # Compare exit code
        if compare_exit_code:
            assert just_bash_result.exit_code == fixture.exit_code, (
                f"exit_code mismatch for: {command}\n"
                f"Expected: {fixture.exit_code}\n"
                f"Actual: {just_bash_result.exit_code}"
            )
