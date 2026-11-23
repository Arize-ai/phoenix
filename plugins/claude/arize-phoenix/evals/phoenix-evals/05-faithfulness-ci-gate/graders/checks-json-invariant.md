---
type: regex
target: {source: file, path: test_faithfulness.py}
match: contains
---
json\.loads|JSONDecodeError|model_validate_json
