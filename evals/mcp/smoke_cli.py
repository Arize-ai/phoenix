"""Run the pinned px binary in a separate, credential-free container.

The agent-side executable forwards argv, stdin, stdout, stderr and exit status.
Only the broker's network peer can reach the gateway's Phoenix REST/GraphQL
routes. Calling this broker with HTTP still executes the real px binary.
"""

import json
import os
import subprocess
import sys
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def cli_request(payload):
    argv = payload.get("argv")
    stdin = payload.get("stdin", "")
    if (
        not isinstance(argv, list)
        or len(argv) > 128
        or not all(isinstance(arg, str) and "\0" not in arg for arg in argv)
        or not isinstance(stdin, str)
    ):
        raise ValueError("Expected CLI arguments and text stdin")
    # No installers, auth/profile changes, external docs fetches, or setup hooks.
    roots = {
        "project",
        "trace",
        "span",
        "trace-annotations",
        "span-annotations",
        "dataset",
        "experiment",
        "api",
        "help",
        "--help",
        "-h",
        "--version",
        "-V",
    }
    if argv and argv[0] not in roots:
        raise ValueError("Command is outside the read-only smoke CLI scope")
    return ["/usr/local/bin/px", *argv], stdin


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", 0))
            if self.path != "/run" or not 0 < size <= 1_000_000:
                raise ValueError("Invalid CLI request")
            payload = json.loads(self.rfile.read(size))
            argv, stdin = cli_request(payload)
            cwd = os.path.normpath(payload.get("cwd", "/workspace"))
            if not any(
                cwd == root or cwd.startswith(root + "/") for root in ("/workspace", "/tmp")
            ):
                raise ValueError("CLI working directory must be in the shared task workspace")
            result = subprocess.run(
                argv,
                input=stdin,
                capture_output=True,
                text=True,
                timeout=240,
                cwd=cwd,
                env={
                    "PATH": "/usr/local/bin:/usr/bin:/bin",
                    "HOME": "/tmp",
                    "PHOENIX_COLLECTOR_ENDPOINT": "http://mcp-gateway:8080",
                    "NO_COLOR": "1",
                },
            )
            output = {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
            }
            data = json.dumps(output).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (ValueError, subprocess.TimeoutExpired) as exc:
            self.send_error(400, str(exc))


def client():
    data = json.dumps(
        {
            "argv": sys.argv[1:],
            "stdin": "" if sys.stdin.isatty() else sys.stdin.read(),
            "cwd": os.getcwd(),
        }
    ).encode()
    request = urllib.request.Request(
        "http://px-broker:8081/run", data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=250) as response:
        result = json.load(response)
    sys.stdout.write(result["stdout"])
    sys.stderr.write(result["stderr"])
    raise SystemExit(result["exit_code"])


if __name__ == "__main__":
    if sys.argv[1:] == ["--serve"]:
        ThreadingHTTPServer(("0.0.0.0", 8081), Handler).serve_forever()
    else:
        client()
