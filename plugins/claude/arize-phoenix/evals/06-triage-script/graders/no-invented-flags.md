---
type: regex
target: {source: file, path: triage.sh}
match: not_contains
---
px trace get[^\n|]*--(json|status|filter|spans|errors?)\b
