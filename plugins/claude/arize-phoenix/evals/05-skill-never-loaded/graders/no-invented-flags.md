---
type: regex
target: last_message
match: not_contains
---
px (trace|span) (list|get)[^\n|]*--(json|filter|where|errors?|status(?!-code)|tools?|turns)\b
