---
type: regex
target: {source: file, path: tracing_setup.py}
match: contains
---
from phoenix\.otel import|arize-phoenix-otel
