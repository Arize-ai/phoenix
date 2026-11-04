---
type: regex
target: {source: file, path: phoenix_export.py}
match: contains
---
os\.environ|os\.getenv|getenv|PHOENIX_API_KEY
