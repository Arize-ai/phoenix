"""Trusted HTTP gateway: one Phoenix interface and inference without hosted tools.

Only this process receives provider credentials. It runs outside the agent's
internal Docker network and cannot proxy arbitrary hosts, paths, or CONNECT.
"""

import json
import os
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LOCK = threading.Lock()
AUDIT = Path("/audit/gateway.jsonl")


def audit(**event):
    with LOCK, AUDIT.open("a") as stream:
        stream.write(json.dumps(event) + "\n")


def local_tool(tool):
    """Allow declarations executed by the isolated client, never hosted tools."""
    kind = tool.get("type", "custom")
    if kind in {"custom", "function", "local_shell", "apply_patch"}:
        return True
    if kind == "namespace":
        return all(local_tool(child) for child in tool.get("tools", []))
    if kind == "tool_search":
        return tool.get("execution") == "client"
    if kind == "shell":
        return tool.get("environment", {}).get("type") == "local"
    return False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward()

    def do_DELETE(self):
        self.forward()

    def forward(self):
        provider = os.environ["PROVIDER"]
        interface = os.environ["INTERFACE"]
        path = self.path.split("?", 1)[0]
        size = int(self.headers.get("Content-Length", 0))
        if size > 8_000_000 or self.headers.get("Transfer-Encoding"):
            return self.send_error(413)
        body = self.rfile.read(size) if size else None
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower()
            in {
                "content-type",
                "accept",
                "mcp-session-id",
                "mcp-protocol-version",
                "anthropic-version",
                "anthropic-beta",
            }
        }
        try:
            peer_file = AUDIT.parent / "cli-peer.json"
            cli_peer = json.loads(peer_file.read_text())["address"] if peer_file.exists() else None
            if path.startswith("/provider/"):
                if self.client_address[0] == cli_peer:
                    raise ValueError("The CLI broker cannot request inference")
                route = path.removeprefix("/provider")
                allowed_routes = (
                    {"/v1/responses"}
                    if provider == "openai"
                    else {"/v1/messages", "/v1/messages/count_tokens"}
                )
                if self.command != "POST" or route not in allowed_routes:
                    raise ValueError("Provider route is not inference")
                payload = json.loads(body or b"{}")
                tools = payload.get("tools") or []
                if not all(local_tool(tool) for tool in tools):
                    audit(kind="rejected_tools", tool_types=[t.get("type") for t in tools])
                    raise ValueError("Hosted tools, including web search, are disabled")
                if payload.get("mcp_servers") or payload.get("container"):
                    raise ValueError("Remote execution is disabled")
                audit(
                    kind="inference",
                    model=payload.get("model"),
                    tool_types=[t.get("type", "custom") for t in tools],
                )
                if provider == "openai":
                    url = "https://api.openai.com" + route
                    headers["Authorization"] = "Bearer " + os.environ["OPENAI_API_KEY"]
                else:
                    url = "https://api.anthropic.com" + route
                    headers["x-api-key"] = os.environ["ANTHROPIC_API_KEY"]
                    headers.setdefault("anthropic-version", "2023-06-01")
            else:
                if interface == "mcp":
                    allowed = path in {"/mcp", "/mcp/"} and self.command in {
                        "GET",
                        "POST",
                        "DELETE",
                    }
                else:
                    if not cli_peer or self.client_address[0] != cli_peer:
                        raise ValueError("Phoenix CLI requests must come from the px broker")
                    allowed = (path.startswith("/v1/") and self.command == "GET") or (
                        path == "/graphql" and self.command == "POST"
                    )
                if not allowed:
                    raise ValueError("Only the assigned Phoenix interface is available")
                url = os.environ["TARGET_URL"] + self.path
                audit(kind="target", method=self.command, path=path)
            request = urllib.request.Request(url, data=body, headers=headers, method=self.command)
            try:
                response = urllib.request.urlopen(request, timeout=300)
            except urllib.error.HTTPError as exc:
                response = exc
            with response:
                self.send_response(response.status)
                for key in ("Content-Type", "Mcp-Session-Id", "Mcp-Protocol-Version"):
                    if value := response.headers.get(key):
                        self.send_header(key, value)
                self.send_header("Connection", "close")
                self.end_headers()
                while chunk := response.read1(65536):
                    self.wfile.write(chunk)
                    self.wfile.flush()
                audit(kind="response", path=path, status=response.status)
        except (ValueError, KeyError) as exc:
            audit(kind="denied", path=path, reason=str(exc))
            self.send_error(403, str(exc))
        except (OSError, urllib.error.URLError) as exc:
            audit(kind="transport_error", path=path, error=type(exc).__name__)
            self.send_error(502)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
