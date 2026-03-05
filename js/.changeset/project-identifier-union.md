---
"@arizeai/phoenix-client": minor
---

Replace `projectIdentifier: string` with a `ProjectIdentifier` discriminated union on `listSessions`. Callers can now pass `{ project: "name-or-id" }`, `{ projectId: "..." }`, or `{ projectName: "..." }` for explicit intent and better IDE autocompletion.
