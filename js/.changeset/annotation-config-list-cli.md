---
"@arizeai/phoenix-cli": minor
---

Add `px annotation-config list` command to list all annotation configurations.

The new command fetches annotation configs from `GET /v1/annotation_configs` with cursor-based pagination and supports `--format pretty|json|raw`, `--limit`, `--endpoint`, `--api-key`, and `--no-progress` options.
