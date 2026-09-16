---
type: regex
target: last_message
match: not_contains
---
px session list[^\n|]*--(filter|status|where|error|errors|min-traces|traces)\b
