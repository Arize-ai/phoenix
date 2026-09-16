---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
---
Write a bash script named `triage.sh` in the current directory. It takes a Phoenix trace id as its first argument and prints, as JSON, the spans in that trace whose status is ERROR, including each span's name and its exception message. Assume the `px` CLI is installed and `PHOENIX_ENDPOINT` is already exported in the environment. Do not run the script, just write it.
