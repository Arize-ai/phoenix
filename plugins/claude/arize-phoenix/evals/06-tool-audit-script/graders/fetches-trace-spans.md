---
type: regex
target: {source: file, path: tool-audit.sh}
match: contains
---
px trace get|px span list(?:[^\n]|\\\n)*--trace-id
