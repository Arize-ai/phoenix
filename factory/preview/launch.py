"""Start Phoenix, run the PR's seed script against it once it is healthy, then stay up.

This is the preview image's command. The seed script is the one the PR body carries; it
runs with PHOENIX_BASE_URL pointing at the local server and with the Phoenix client,
OTel SDK and OTLP exporter importable from the image. Its output is relayed line by line
under a `seed| ` prefix as it appears, and its outcome goes to the container log as a
`preview: seed` line, which deploy.py reads; neither stops the server, so a reviewer can
still open an instance whose seed failed.
"""

import os
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import seed_log

SEED_PATH = Path("/phoenix/preview/seed.py")

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
    """Probe until the server answers or exits; Railway's own health check sets the deadline."""
    while server.poll() is None:
        try:
            with urllib.request.urlopen(f"{url}/healthz", timeout=5) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(2)
    return False


def relay(stream: Any) -> None:
    for raw in iter(stream.readline, b""):
        print(f"{seed_log.OUTPUT_PREFIX}{raw.decode(errors='replace').rstrip()}", flush=True)


def run_seed(url: str) -> None:
    if not SEED_PATH.exists() or not SEED_PATH.read_text().strip():
        print(seed_log.NO_SEED_LINE, flush=True)
        return
    env = {**os.environ, "PHOENIX_BASE_URL": url, "PHOENIX_COLLECTOR_ENDPOINT": url}
    print(seed_log.START_LINE, flush=True)
    seed = subprocess.Popen(
        [sys.executable, str(SEED_PATH)],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    children.append(seed)
    # Lines reach the log as the seed prints them, so a stuck seed shows where it stuck.
    relay_thread = threading.Thread(target=relay, args=(seed.stdout,), daemon=True)
    relay_thread.start()
    try:
        seed.wait(timeout=seed_log.SEED_TIMEOUT_SECONDS)
        outcome = (
            seed_log.FINISHED_LINE
            if seed.returncode == 0
            else f"{seed_log.FAILED_PREFIX}{seed.returncode}"
        )
    except subprocess.TimeoutExpired:
        seed.kill()
        seed.wait()
        outcome = f"{seed_log.TIMED_OUT_PREFIX}{seed_log.SEED_TIMEOUT_SECONDS} seconds"
    # The pipe closes when the seed and anything it spawned let go of it; a helper that
    # outlives the seed is the one case this does not cover, and the outcome then precedes
    # its remaining lines.
    relay_thread.join(timeout=seed_log.RELAY_DRAIN_SECONDS)
    print(outcome, flush=True)


def main() -> int:
    print(seed_log.LAUNCH_LINE, flush=True)
    server = subprocess.Popen([sys.executable, "-m", "phoenix.server.main", "serve"])
    children.append(server)
    signal.signal(signal.SIGTERM, forward)
    signal.signal(signal.SIGINT, forward)

    url = base_url()
    if wait_until_healthy(server, url):
        run_seed(url)
    else:
        print(seed_log.UNHEALTHY_LINE, flush=True)
    exit_code = server.wait()
    # A stop the launcher forwarded is a clean exit; any other signal death is a failure
    # that the restart policy should see, reported the way a shell would (128 + signal).
    if stopping:
        return 0
    return 128 - exit_code if exit_code < 0 else exit_code


if __name__ == "__main__":
    sys.exit(main())
