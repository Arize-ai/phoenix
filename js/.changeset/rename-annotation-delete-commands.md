---
"@arizeai/phoenix-cli": minor
"@arizeai/phoenix-client": minor
---

Restructure annotation bulk-delete commands into entity-first compound nouns:
`px span delete-annotations` becomes `px span-annotations delete`,
`px trace delete-annotations` becomes `px trace-annotations delete`, and
`px session delete-annotations` becomes `px session-annotations delete`. Flag
set, authorization gate (`--all` XOR `[--start-time, --end-time)`), payload
shape, and exit codes are unchanged.

Add an optional `identifier` body field to `addTraceNote`, `addSpanNote`, and
`addSessionNote` (and the generated REST types). When non-empty, the note is
upserted on `(entity_id, name='note', identifier)` so repeated calls with the
same identifier overwrite the existing note instead of appending. When the
helper is given an `identifier`, it now also calls
`ensureServerCapability` against the new identifier body-parameter
requirement so the caller fails fast against older Phoenix servers (which
would otherwise silently drop the field and append an auto-generated note).
