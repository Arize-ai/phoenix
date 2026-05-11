---
"@arizeai/phoenix-cli": minor
---

Restructure annotation bulk-delete commands into entity-first compound nouns:
`px span delete-annotations` becomes `px span-annotations delete`,
`px trace delete-annotations` becomes `px trace-annotations delete`, and
`px session delete-annotations` becomes `px session-annotations delete`. Flag
set, authorization gate (`--all` XOR `[--start-time, --end-time)`), payload
shape, and exit codes are unchanged.
