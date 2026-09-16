---
type: regex
target: last_message
match: contains
---
error_count\s*>\s*0|\.status\s*==\s*["']ERROR["']|status_code\s*==\s*\\?["']ERROR
