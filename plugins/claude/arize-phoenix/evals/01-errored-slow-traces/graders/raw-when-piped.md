---
type: regex
target: last_message
match: not_contains
---
px trace (list|get)(?![^\n|]*--format raw)[^\n|]*\|
