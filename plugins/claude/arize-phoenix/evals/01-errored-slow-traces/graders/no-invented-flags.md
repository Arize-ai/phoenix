---
type: regex
target: last_message
match: not_contains
---
px trace list[^\n|]*--(status|filter|json|error|errors|where)\b
