---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Read]
runs: 3
---
Our support agent, Phoenix project `helpdesk`, sometimes takes 30 or more LLM calls to answer a one-line question like "what's your refund window", and customers see 40 second latency. Nothing errors, so the traces look green. I have the `px` CLI installed and `PHOENIX_ENDPOINT` set, but you can't reach it from here. Walk me through exactly what to run to find these traces, and what to look for inside them to figure out why the agent is taking so many turns.
