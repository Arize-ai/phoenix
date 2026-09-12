---
"@arizeai/phoenix-client": minor
---

Add a `getModelProviders` helper under the `models` subpath. The helper
uses `GET /v1/model_providers` to return the typed built-in provider families
enabled by the Phoenix server, including deployments whose allow-list produces
an empty result.
