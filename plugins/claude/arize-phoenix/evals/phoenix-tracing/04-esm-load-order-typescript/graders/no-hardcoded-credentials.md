---
type: regex
target: {source: file, path: instrumentation.ts}
match: not_contains
---
sk-[A-Za-z0-9]{16,}|apiKey:\s*["'][A-Za-z0-9]
