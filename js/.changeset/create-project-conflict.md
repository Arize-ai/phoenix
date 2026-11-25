---
"@arizeai/phoenix-client": patch
---

Add the `409 Conflict` response to the generated types for `POST /v1/projects` (`createProject`), which the server now returns when a project with the same name already exists.
