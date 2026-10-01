---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
I want my CI to fail when my RAG bot's faithfulness regresses. We already use pytest for everything else, so I'd like the eval to run as a pytest test, record results to Phoenix so I can track them over time, and gate the build. The suite also has a couple of hard invariants (the response must be non-empty and valid JSON) that should fail immediately. Write it to `test_faithfulness.py` in the current directory. Do not run it.
