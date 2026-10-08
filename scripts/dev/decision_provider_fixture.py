"""Local System One protocol fixture for browser testing, not a real model.

Run with `make dev-decision-fixture`. Point the playground's TypeSafe base URL
at http://127.0.0.1:16138/v1 and supply the local key `fixture-test-key`.
Set the model to `fixture-429` to exercise the upstream error path.
Use `fixture-slow` to exercise local cancellation with a delayed response.
"""

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path != "/v1/systemone":
            self.respond(404, {"error": "Unknown fixture endpoint"})
            return
        if self.headers.get("Authorization") != "Bearer fixture-test-key":
            self.respond(401, {"error": "Use the fixture key"})
            return
        request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        print(json.dumps({"fixture_request": request}), flush=True)
        if request["model"] == "fixture-429":
            self.respond(429, {"error": "Fixture rate limit"})
            return
        if request["model"] == "fixture-slow":
            time.sleep(5)
        answers: dict[str, Any] = {}
        for name, question in request["questions"].items():
            kind = question["type"]
            if kind == "choice":
                choices = list(question["criteria"])
                answer = {
                    "type": kind,
                    "choice": choices[0],
                    "confidence": 0.98,
                    "probabilities": {
                        choice: 1.0 if index == 0 else 0.0 for index, choice in enumerate(choices)
                    },
                }
            elif kind == "noul":
                answer = {"type": kind, "noul": 0.94}
            elif kind == "score":
                levels = question["criteria"]
                answer = {
                    "type": kind,
                    "score": 0.75,
                    "confidence": 0.9,
                    "legend": {str(index): level for index, level in enumerate(levels)},
                    "probabilities": {
                        str(index): 0.25 if index == 0 else 0.75 if index == 1 else 0.0
                        for index in range(len(levels))
                    },
                }
            else:
                self.respond(422, {"error": "Unknown question type"})
                return
            answers[name] = answer
        self.respond(
            200,
            {
                "model": request["model"],
                "answers": answers,
                "usage": {"input_tokens": 123, "output_tokens": 0},
                "fixture": True,
            },
        )

    def respond(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("MOCK TypeSafe/System One fixture: http://127.0.0.1:16138/v1", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 16138), Handler).serve_forever()
