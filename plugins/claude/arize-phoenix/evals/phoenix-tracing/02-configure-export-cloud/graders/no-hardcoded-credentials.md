---
type: regex
target: {source: file, path: phoenix_export.py}
match: not_contains
---
sk-[A-Za-z0-9]{16,}|api_key\s*=\s*["'][A-Za-z0-9]
