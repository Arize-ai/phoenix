"""Check agent network and file access before Harbor starts the coding agent."""

import concurrent.futures
import json
import os
import socket
import subprocess
import sys
import urllib.request
from pathlib import Path


def cannot_connect(address):
    try:
        with socket.create_connection(address, timeout=2):
            return False
    except OSError:
        return True


def main():
    addresses = [
        ("example.com", 443),
        ("github.com", 443),
        ("raw.githubusercontent.com", 443),
        ("docs.arize.com", 443),
        ("huggingface.co", 443),
        ("pypi.org", 443),
        ("1.1.1.1", 80),
        ("host.docker.internal", 6006),
        ("host.docker.internal", 6007),
        ("169.254.169.254", 80),
    ]
    with concurrent.futures.ThreadPoolExecutor() as pool:
        checks = dict(zip((f"{h}:{p}" for h, p in addresses), pool.map(cannot_connect, addresses)))
    checks["private_files_absent"] = not any(
        Path(path).exists()
        for path in ("/seed", "/evidence", "/tests", "/solution", "/data", "/var/run/docker.sock")
    )
    with urllib.request.urlopen("http://127.0.0.1:6006/v1/projects", timeout=10) as response:
        checks["local_phoenix_available"] = response.status == 200
    if os.environ["BENCHMARK_INTERFACE"] == "cli":
        checks["px_installed"] = (
            subprocess.run(["px", "--version"], capture_output=True, timeout=20).returncode == 0
        )
    else:
        import shutil

        checks["px_absent"] = shutil.which("px") is None
    print(json.dumps(checks), flush=True)
    if not all(checks.values()):
        raise RuntimeError("Agent environment checks failed")
    Path("/tmp/benchmark-ready").touch()
    os.execvp(sys.argv[1], sys.argv[1:])


if __name__ == "__main__":
    main()
