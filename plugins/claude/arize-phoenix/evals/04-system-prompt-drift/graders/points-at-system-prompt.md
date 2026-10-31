---
type: regex
target: last_message
match: contains
flags: i
---
system (prompt|message|instruction)|llm\.input_messages\.0
