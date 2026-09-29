#!/usr/bin/env python3
"""The TypeError recorded on PageDownTool error spans."""

import sys

sys.path.insert(0, "/opt/verifier")

import re

from evals.harbor.verifiers.phoenix_api import project_spans, write_answer

messages = [
    span.get("status_message", "")
    for span in project_spans("research-assistant")
    if span["name"] == "PageDownTool" and span.get("status_message")
]
message = next(
    message for message in messages if re.search(r"unexpected keyword argument '\w*'", message)
)
write_answer(
    "The agent calls PageDownTool with a keyword argument that its forward() method does not accept: "
    + message
)
