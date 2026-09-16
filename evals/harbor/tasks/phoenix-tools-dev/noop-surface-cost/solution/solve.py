#!/usr/bin/env python3
"""Write the fixed response for the control task."""

answer = "ok"

with open("/app/answer.txt", "w") as handle:
    handle.write(answer + "\n")
print(answer)
