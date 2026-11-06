---
type: regex
target: {source: file, path: tool-audit.sh}
match: not_contains
---
select\([^)]*status_code\s*[!=]=
