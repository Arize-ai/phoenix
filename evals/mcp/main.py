"""Small Make entrypoint: prepare, images, run, check, format, preflight."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=["prepare", "images", "run", "check", "format", "preflight"]
    )
    args, rest = parser.parse_known_args()
    if args.command in {"check", "format"}:
        fix = args.command == "format"
        subprocess.run(
            [sys.executable, "-m", "ruff", "format", *([] if fix else ["--check"]), str(HERE)],
            check=True,
        )
        subprocess.run(
            [sys.executable, "-m", "ruff", "check", *(["--fix"] if fix else []), str(HERE)],
            check=True,
        )
        if not fix:
            subprocess.run(
                [sys.executable, "-m", "pytest", "-q", str(HERE / "tests"), *rest], check=True
            )
            subprocess.run(
                [sys.executable, "-m", "mypy", "--config-file", str(HERE / "pyproject.toml")],
                check=True,
            )
            server_python = HERE.parents[1] / ".venv/bin/python"
            subprocess.run(
                [
                    str(server_python),
                    "-m",
                    "pytest",
                    "-q",
                    "-o",
                    "addopts=",
                    str(HERE / "tests/integration"),
                ],
                check=True,
                env=os.environ
                | {
                    "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
                    "PYTEST_ADDOPTS": "-p pytest_asyncio.plugin",
                },
            )
    else:
        subprocess.run([sys.executable, str(HERE / (args.command + ".py")), *rest], check=True)


if __name__ == "__main__":
    main()
