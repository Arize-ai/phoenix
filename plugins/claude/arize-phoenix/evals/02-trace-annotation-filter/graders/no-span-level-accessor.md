---
type: regex
target: last_message
match: not_contains
---
(filterCondition|traceFilterCondition):\s*"(?:[^"\\]|\\.)*?(?<!trace_)(?<!session_)annotations\[
