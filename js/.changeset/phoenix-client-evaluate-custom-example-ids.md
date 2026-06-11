---
"@arizeai/phoenix-client": patch
---

Fix `evaluateExperiment` failing to match experiment runs to dataset examples when the dataset was uploaded with custom example ids. Runs now consistently identify examples by node GlobalID in `datasetExampleId` — previously runs created in-process recorded the custom example id while runs fetched from the server recorded the GlobalID — and the evaluation example lookup is keyed by the GlobalID to match. Run recording also falls back to the example `id` field on servers that predate node ids (where that field carries the GlobalID), instead of posting an empty `dataset_example_id`.
