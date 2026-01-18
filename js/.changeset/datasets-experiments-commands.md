---
"@arizeai/phoenix-cli": minor
---

Add datasets and experiments commands to the CLI:

- `px datasets` - List all available Phoenix datasets with example counts and metadata
- `px experiments --dataset <name-or-id>` - List experiments for a dataset, optionally export full experiment data to a directory
- `px experiment <experiment-id>` - Fetch a single experiment with all run data, evaluations, and trace IDs

All commands support `--format pretty|json|raw` output modes for both human readability and machine consumption.
