# @arizeai/phoenix-cli

## 0.2.0

### Minor Changes

- 32343ff: Add datasets and experiments commands to the CLI:
  - `px datasets` - List all available Phoenix datasets with example counts and metadata
  - `px dataset <name-or-id>` - Fetch examples from a dataset with optional `--split` and `--version` filters
  - `px experiments --dataset <name-or-id>` - List experiments for a dataset, optionally export full experiment data to a directory
  - `px experiment <experiment-id>` - Fetch a single experiment with all run data, evaluations, and trace IDs

  All commands support `--format pretty|json|raw` output modes for both human readability and machine consumption.

## 0.1.0

### Minor Changes

- d69eb80: initial trace dump api

## 0.0.4

### Patch Changes

- 4208604: trigger changeset publish

## 0.0.3

### Patch Changes

- c96475c: trigger changeset publish

## 0.0.2

### Patch Changes

- 857b617: add links to packages

## 0.0.1

### Patch Changes

- 30242a6: initial cli
