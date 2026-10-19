---
max_turns: 12
timeout_seconds: 300
allowed_tools: [Skill, Read, Write]
runs: 3
tags: [phoenix-evals]
---
I want CI to catch regressions in my RAG bot. Its responses must always be non-empty, valid JSON, and I want to know when faithfulness drops. We already use pytest for everything else, and I'd like the results recorded to Phoenix so I can track them over time. Add it as `test_faithfulness.py`.
