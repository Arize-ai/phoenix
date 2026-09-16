---
type: regex
target: {source: file, path: tool-audit.sh}
match: not_contains
---
px spans\b|px span get\b|px trace spans\b|--format json\b|--output json\b
