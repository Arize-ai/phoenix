---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Skill, Read]
runs: 3
---
I am using the Phoenix web framework in Elixir. My LiveView is not re-rendering after I update state in handle_event. The event fires (I can see it in the log) but the template does not change. What am I doing wrong?
