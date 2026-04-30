---
"@arizeai/phoenix-client": patch
---

Clarify TSDoc and regenerated OpenAPI descriptions for `addSpanNote` and `addTraceNote`. Previous wording implied structured annotations were "unique by name", which is incorrect — annotations are keyed by `(name, target_id, identifier)`, so multiple annotations with the same name can coexist on the same span/trace/session by supplying distinct identifiers. Notes remain append-only via auto-generated UUIDv4 identifiers.
