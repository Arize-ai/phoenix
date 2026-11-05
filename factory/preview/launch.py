"""Start Phoenix, run the PR's seed script against it once it is healthy, then stay up.

This is the preview image's command. The seed script is the one the PR body carries; it
runs with PHOENIX_BASE_URL pointing at the local server and with the Phoenix client,
OTel SDK and OTLP exporter importable from the image. Its outcome goes to the container
log and never stops the server, so a reviewer can still open an instance whose seed failed.
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


def base_url() -> str:
    port = os.environ.get("PHOENIX_PORT") or os.environ.get("PORT") or "6006"
    return f"http://127.0.0.1:{port}"


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
    env = {
        **os.environ,
        "PHOENIX_BASE_URL": url,
        "PHOENIX_COLLECTOR_ENDPOINT": url,
    }
    print("preview: running the seed script", flush=True)
    completed = subprocess.run([sys.executable, str(SEED_PATH)], env=env)
    status = "finished" if completed.returncode == 0 else f"failed with exit {completed.returncode}"
    print(f"preview: seed {status}", flush=True)


def main() -> int:
    server = subprocess.Popen([sys.executable, "-m", "phoenix.server.main", "serve"])
    stopping = False

    def forward(signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True
        server.send_signal(signum)

    signal.signal(signal.SIGTERM, forward)
    signal.signal(signal.SIGINT, forward)

    url = base_url()
    if wait_until_healthy(server, url):
        run_seed(url)
    elif server.poll() is None:
        print("preview: the server did not become healthy; skipping the seed", flush=True)
    exit_code = server.wait()
    return 0 if stopping else exit_code


if __name__ == "__main__":
    sys.exit(main())
