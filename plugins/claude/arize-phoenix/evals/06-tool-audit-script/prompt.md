---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
---
Write a bash script named `tool-audit.sh` in the current directory. It takes a Phoenix trace id as its first argument and prints, in time order, every TOOL span in that trace as JSON with the span name, status_code, the tool's input parameters, and the tool's output. I use it to spot the agent passing made-up parameters to tools, so it must include tool spans whose status is OK, not just errored ones: that is where the bad parameters hide. Assume the `px` CLI is installed and `PHOENIX_ENDPOINT` is exported. Do not run the script, just write it.
