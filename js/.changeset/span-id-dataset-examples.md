---
"@arizeai/phoenix-client": minor
---

feat: Add spanId support for linking dataset examples to traces

- Added `spanId` field to the `Example` interface for linking dataset examples back to their source spans
- Updated `createDataset` to accept examples with `spanId` and pass them to the API
- Updated `appendDatasetExamples` to accept examples with `spanId` and pass them to the API
- Added comprehensive unit tests for span ID functionality
- Added example script demonstrating how to create datasets from spans with trace associations

This feature enables traceability from datasets back to the original traces in Phoenix, making it easier to understand the provenance of dataset examples.
