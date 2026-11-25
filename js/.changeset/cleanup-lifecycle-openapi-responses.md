---
"@arizeai/phoenix-client": patch
---

Update generated OpenAPI types with `409` conflict responses on `deleteProject`, `deleteProjectTraces`, `deleteDatasetById`, and `deleteExperiment`, and a `422` response on `deleteExperiment`; `deleteExperiment` reads the 404 from the response status.
