"""Start Phoenix, run the PR's seed script against it once it is healthy, then stay up.

This is the preview image's command. The seed script is the one the PR body carries; it
runs with PHOENIX_BASE_URL pointing at the local server and with the Phoenix client,
OTel SDK and OTLP exporter importable from the image. Its output is relayed line by line
under a `seed| ` prefix, and its outcome goes to the container log as a `preview: seed`
line, which deploy.py reads; neither stops the server, so a reviewer can still open an
instance whose seed failed.
"""

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SEED_PATH = Path("/phoenix/preview/seed.py")
HEALTHY_TIMEOUT_SECONDS = 300
SEED_TIMEOUT_SECONDS = 480
SEED_LINE_PREFIX = "seed| "

children: list[subprocess.Popen[bytes]] = []
stopping = False


def base_url() -> str:
    # The server reads PHOENIX_PORT and nothing else, so neither does the launcher.
    return f"http://127.0.0.1:{os.environ.get('PHOENIX_PORT') or '6006'}"


def forward(signum: int, _frame: object) -> None:
    global stopping
    stopping = True
    for child in children:
        if child.poll() is None:
            child.send_signal(signum)


def wait_until_healthy(server: subprocess.Popen[bytes], url: str) -> bool:
    deadline = time.monotonic() + HEALTHY_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if server.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(f"{url}/healthz", timeout=5) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(2)
    return False


def run_seed(url: str) -> None:
    if not SEED_PATH.exists() or not SEED_PATH.read_text().strip():
        print("preview: no seed script; the instance starts empty", flush=True)
        return
    env = {**os.environ, "PHOENIX_BASE_URL": url, "PHOENIX_COLLECTOR_ENDPOINT": url}
    print("preview: running the seed script", flush=True)
    seed = subprocess.Popen(
        [sys.executable, str(SEED_PATH)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    children.append(seed)
    try:
        output, _ = seed.communicate(timeout=SEED_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        seed.kill()
        output, _ = seed.communicate()  # drains the pipe and reaps the process
        outcome = f"preview: seed timed out after {SEED_TIMEOUT_SECONDS} seconds"
    else:
        outcome = (
            "preview: seed finished"
            if seed.returncode == 0
            else f"preview: seed failed with exit {seed.returncode}"
        )
    for line in output.decode(errors="replace").splitlines():
        print(f"{SEED_LINE_PREFIX}{line}", flush=True)
    print(outcome, flush=True)


def main() -> int:
    server = subprocess.Popen([sys.executable, "-m", "phoenix.server.main", "serve"])
    children.append(server)
    signal.signal(signal.SIGTERM, forward)
    signal.signal(signal.SIGINT, forward)

    url = base_url()
    if wait_until_healthy(server, url):
        run_seed(url)
    elif server.poll() is None:
        print("preview: the server did not become healthy; skipping the seed", flush=True)
    exit_code = server.wait()
    # A stop the launcher forwarded is a clean exit; any other signal death is a failure
    # that the restart policy should see.
    return 0 if stopping else exit_code


if __name__ == "__main__":
    sys.exit(main())
