---
"@arizeai/phoenix-client": minor
---

Add experiment resume and management features

**New APIs:**

- `resumeExperiment()` - Resume incomplete experiment runs (handles failed or missing runs)
- `resumeEvaluation()` - Add evaluations to completed experiments or retry failed evaluations
- `listExperiments()` - List experiments with filtering and pagination
- `deleteExperiment()` - Delete experiments
