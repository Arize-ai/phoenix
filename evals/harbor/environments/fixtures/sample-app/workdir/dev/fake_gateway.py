"""A local stand-in for Acme's LLM gateway, for development without model access.

It serves the OpenAI chat completions route at `http://127.0.0.1:8100/v1` and answers
the support bot's questions with fixed, rule-based replies, including the gateway's
tokens-per-minute limit. Start it before running the bot:

    python dev/fake_gateway.py &
"""

from __future__ import annotations

import argparse
import json
import re
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

# Requests above this many prompt tokens get the gateway's 429 response.
TOKENS_PER_MINUTE_LIMIT = 30_000


def prompt_tokens(messages: list[dict[str, Any]]) -> int:
    return sum(len(json.dumps(message)) for message in messages) // 4


def tool_call(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"call_{uuid.uuid4().hex[:12]}",
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments)},
    }


def last_order_id(messages: list[dict[str, Any]]) -> str | None:
    for message in reversed(messages):
        if message.get("role") == "user":
            found = re.search(r"order (\d+)", message.get("content") or "")
            if found:
                return found.group(1)
    return None


def plan_tool_call(question: str, messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Returns the tool call the model makes for a new question, or None to reply."""
    text = question.lower()
    if "enterprise" in text and "email" in text:
        # The model guesses a column name instead of the schema's `email`.
        query = "SELECT customer_email FROM customers WHERE plan = 'enterprise'"
        return tool_call("run_sql", {"query": query})
    if "arrive" in text and (order := last_order_id(messages)):
        return tool_call("run_sql", {"query": f"SELECT eta FROM orders WHERE id = {order}"})
    if match := re.search(r"order (\d+)", text):
        query = f"SELECT status FROM orders WHERE id = {match.group(1)}"
        return tool_call("run_sql", {"query": query})
    if "every" in text and "polic" in text:
        return tool_call("get_policy", {"topic": "all"})
    for topic, keyword in (("refunds", "refund"), ("warranty", "warranty"), ("shipping", "ship")):
        if keyword in text:
            return tool_call("get_policy", {"topic": topic})
    return None


def reply_to_tool(question: str, output: str) -> str:
    """Returns the model's reply after it reads a tool's output."""
    text = question.lower()
    try:
        result = json.loads(output)
    except json.JSONDecodeError:
        return output if len(output) < 500 else "Here is a summary of every store policy."
    if "error" in result or not result.get("rows"):
        if "email" in text:
            return "I checked the database and there are no enterprise customers with an email on file."
        return "I couldn't find that order."
    value = result["rows"][0][0]
    if "arrive" in text:
        return f"It should arrive on {value}."
    order = re.search(r"order (\d+)", text)
    return f"Order {order.group(1) if order else ''} is {value}."


def complete(request: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Returns the status code and body for one chat completions request."""
    messages = request["messages"]
    tokens = prompt_tokens(messages)
    if tokens > TOKENS_PER_MINUTE_LIMIT:
        message = (
            f"Rate limit reached for {request['model']} on tokens per min (TPM): "
            f"Limit {TOKENS_PER_MINUTE_LIMIT}, Requested {tokens}."
        )
        error = {"message": message, "type": "tokens", "code": "rate_limit_exceeded"}
        return 429, {"error": error}
    question = next(m["content"] for m in reversed(messages) if m["role"] == "user")
    reply: dict[str, Any] = {"role": "assistant", "content": None}
    if messages[-1]["role"] == "tool":
        reply["content"] = reply_to_tool(question, messages[-1]["content"])
    elif call := plan_tool_call(question, messages):
        reply["tool_calls"] = [call]
    else:
        reply["content"] = "I can help with orders and store policies."
    completion_tokens = len(json.dumps(reply)) // 4
    return 200, {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request["model"],
        "choices": [
            {
                "index": 0,
                "message": reply,
                "finish_reason": "tool_calls" if reply.get("tool_calls") else "stop",
            }
        ],
        "usage": {
            "prompt_tokens": tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": tokens + completion_tokens,
        },
    }


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if not self.path.rstrip("/").endswith("/chat/completions"):
            self.send_error(404)
            return
        request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        status, body = complete(request)
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        self.send_response(200 if self.path == "/healthz" else 404)
        self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8100)
    args = parser.parse_args()
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
