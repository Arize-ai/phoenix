---
type: regex
target: {source: file, path: triage.sh}
match: contains
---
status_code\s*==\s*\\?"ERROR"
