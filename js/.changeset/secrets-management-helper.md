---
"@arizeai/phoenix-client": minor
---

Add an `upsertOrDeleteSecrets` helper to the new `secrets` subpath. It atomically creates, updates, or deletes ordered key/value-or-null batches through `PUT /v1/secrets`, returns only the affected key names, and keeps submitted values out of helper output and error messages.
