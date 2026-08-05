---
"@arizeai/phoenix-client": minor
---

Add a `getProjects` helper to the new `@arizeai/phoenix-client/projects` entry point. It lists projects with automatic cursor pagination and accepts an optional `nameContains` filter, which maps to the `name_contains` query parameter on `GET /v1/projects` (case-insensitive substring match, requires Phoenix server >= 17.16.0).
