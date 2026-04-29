---
"@arizeai/phoenix-client": patch
---

Gate `example_ids` on dataset upload (`createDataset`, `appendDatasetExamples`) by server version, so callers see a clear capability error when targeting a Phoenix server older than 15.0.0 instead of a confusing server-side failure.
