"""Local decision provider fixture for browser testing, not a real model.

Run with `make dev-decision-fixture`, then point Phoenix at it:

    TYPESAFE_BASE_URL=http://127.0.0.1:16138/v1 TYPESAFE_API_KEY=fixture-test-key
    OPENAI_BASE_URL=http://127.0.0.1:16138/v1  OPENAI_API_KEY=fixture-test-key

or enter the base URL and the key `fixture-test-key` in the playground.

Routes:
    POST /v1/systemone   TypeSafe System One body -> named answers
    POST /v1/decisions   OpenAI Decisions body -> answer array

Sentinel models exercise failure paths: `fixture-429` answers HTTP 429 and
`fixture-slow` waits five seconds before answering. Malformed bodies answer
HTTP 400 instead of dropping the connection. Every request is logged as one
JSON line with the path, model, and whether a bearer token was present; the
token itself is never logged.
"""

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

HOST = "127.0.0.1"
PORT = 16138
FIXTURE_KEY = "fixture-test-key"
SLOW_MODEL_DELAY_SECONDS = 5


def _system_one_answer(question: dict[str, Any]) -> dict[str, Any]:
    kind = question.get("type")
    criteria = question.get("criteria")
    if kind == "choice" and isinstance(criteria, dict) and criteria:
        choices = list(criteria)
        return {
            "type": kind,
            "choice": choices[0],
            "confidence": 0.98,
            "probabilities": {
                choice: 1.0 if index == 0 else 0.0 for index, choice in enumerate(choices)
            },
        }
    if kind == "noul":
        return {"type": kind, "noul": 0.94}
    if kind == "score" and isinstance(criteria, list) and criteria:
        return {
            "type": kind,
            "score": 0.75,
            "confidence": 0.9,
            "legend": {str(index): level for index, level in enumerate(criteria)},
            "probabilities": {
                str(index): 0.25 if index == 0 else 0.75 if index == 1 else 0.0
                for index in range(len(criteria))
            },
        }
    raise ValueError(f"Unsupported question: {json.dumps(question)[:200]}")


def _openai_answer(question: dict[str, Any]) -> dict[str, Any]:
    kind = question.get("type")
    name = question.get("name")
    if not isinstance(name, str):
        raise ValueError("Each OpenAI question needs a name")
    if kind == "choice":
        values = [choice.get("value") for choice in question.get("choices", [])]
        if not values:
            raise ValueError(f"Choice question {name} has no choices")
        return {
            "name": name,
            "type": "choice",
            "choice": values[0],
            "confidence": 0.98,
            "probabilities": [
                {"value": value, "probability": 1.0 if index == 0 else 0.0}
                for index, value in enumerate(values)
            ],
        }
    if kind == "predicate":
        return {"name": name, "type": "predicate", "probability": 0.94}
    if kind == "score":
        levels = question.get("levels", [])
        if not levels:
            raise ValueError(f"Score question {name} has no levels")
        return {
            "name": name,
            "type": "score",
            "score": 0.75,
            "confidence": 0.9,
            "probabilities": [
                {
                    "value": index,
                    "label": level.get("label", str(index)),
                    "probability": 0.25 if index == 0 else 0.75 if index == 1 else 0.0,
                }
                for index, level in enumerate(levels)
            ],
        }
    raise ValueError(f"Unsupported question type: {kind!r}")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path not in ("/v1/systemone", "/v1/decisions"):
            self.respond(404, {"error": f"Unknown fixture endpoint {self.path}"})
            return
        authorization = self.headers.get("Authorization", "")
        if authorization != f"Bearer {FIXTURE_KEY}":
            self.log_request_line(path=self.path, model=None, has_token=bool(authorization))
            self.respond(401, {"error": "Use the fixture key"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            request = json.loads(self.rfile.read(length)) if length else None
        except (ValueError, TypeError):
            self.respond(400, {"error": "Body is not valid JSON"})
            return
        if not isinstance(request, dict):
            self.respond(400, {"error": "Body must be a JSON object"})
            return
        model = request.get("model")
        self.log_request_line(path=self.path, model=model, has_token=True, body=request)
        if model == "fixture-429":
            self.respond(429, {"error": "Fixture rate limit"})
            return
        if model == "fixture-slow":
            time.sleep(SLOW_MODEL_DELAY_SECONDS)
        try:
            if self.path == "/v1/systemone":
                questions = request["questions"]
                if not isinstance(questions, dict):
                    raise ValueError("System One `questions` must be an object")
                answers: Any = {
                    name: _system_one_answer(question) for name, question in questions.items()
                }
            else:
                questions = request["questions"]
                if not isinstance(questions, list):
                    raise ValueError("OpenAI `questions` must be an array")
                answers = [_openai_answer(question) for question in questions]
        except (KeyError, ValueError, AttributeError, TypeError) as error:
            self.respond(422, {"error": str(error) or "Unprocessable request"})
            return
        self.respond(
            200,
            {
                "model": model,
                "answers": answers,
                "usage": {"input_tokens": 123, "output_tokens": 0},
                "fixture": True,
            },
        )

    def log_request_line(
        self,
        *,
        path: str,
        model: Any,
        has_token: bool,
        body: dict[str, Any] | None = None,
    ) -> None:
        line: dict[str, Any] = {"path": path, "model": model, "bearer_token": has_token}
        if body is not None:
            line["fixture_request"] = body
        print(json.dumps(line), flush=True)

    def log_message(self, format: str, *args: Any) -> None:
        # The JSON lines above are the log; silence the default access log.
        return

    def respond(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(
        f"MOCK decision provider fixture: http://{HOST}:{PORT}/v1 "
        f"(System One at /v1/systemone, OpenAI Decisions at /v1/decisions, key {FIXTURE_KEY!r})",
        flush=True,
    )
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
