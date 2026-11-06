---
type: regex
target: {source: file, path: tool-audit.sh}
match: not_contains
---
px (trace|span) (list|get)[^\n|]*--(json|status(?!-code)|filter|where|spans|tools?|kind(?<!span-kind)|errors?)\b
