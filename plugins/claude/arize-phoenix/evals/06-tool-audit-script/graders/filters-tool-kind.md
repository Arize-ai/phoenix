---
type: regex
target: {source: file, path: tool-audit.sh}
match: contains
---
span_kind[^\n]{0,40}\bTOOL\b|--span-kind\s+TOOL
