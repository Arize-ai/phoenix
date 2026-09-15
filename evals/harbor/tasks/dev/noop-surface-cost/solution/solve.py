#!/usr/bin/env python3
"""Reference solution: the control task asks for a fixed reply."""

answer = "ok"

with open("/workspace/answer.txt", "w") as handle:
    handle.write(answer + "\n")
print(answer)
