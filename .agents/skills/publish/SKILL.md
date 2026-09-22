---
name: publish
description: Publish a Harbor task or dataset to the registry. Use when the user wants to upload, publish, or share tasks or datasets/benchmarks on the Harbor registry.
---

Help the user publish a Harbor task or dataset to the registry. Walk them through each step, checking prerequisites and confirming before running publish commands.

All commands use `uvx harbor` so the user does not need to install the CLI globally.

## Prerequisites

1. **Auth**: Ensure the user is logged in by running `uvx harbor auth status`. If not logged in, prompt them to run `uvx harbor auth login`.

2. **Task identifiers**: All tasks must have a `[task]` section in their `task.toml` with a name like `<org>/<name>`. If missing, run:
   ```bash
   uvx harbor task update "<path/to/task>" --org "<org>"
   ```
   To update all tasks in a directory:
   ```bash
   uvx harbor task update "<path/to/tasks>" --org "<org>" --scan
   ```

## Publishing a task

```bash
uvx harbor publish "<path/to/task>"
```

Publish multiple tasks or all tasks in a directory:
```bash
uvx harbor publish "<path/to/task-a>" "<path/to/task-b>"
uvx harbor publish "<path/to/tasks>"
```

## Publishing a dataset

### 1. Initialize the dataset manifest (if no `dataset.toml` exists)

```bash
uvx harbor dataset init "<org>/<dataset>" \
  --description "<description>" \
  --author "Jane Doe <jane@example.com>"
```

Add `--with-metric` if the user needs a custom metric script. If omitted, the dataset uses the default metric (average reward across tasks, with missing values treated as 0).

**Auto-add behavior:** If `dataset init` is run in a directory that already contains tasks, those tasks are automatically added to the manifest. After init, **ask the user if they want to add additional tasks** — either from the Harbor registry or from other local folders.

### 2. Add additional tasks and files (optional)

```bash
cd "<path/to/dataset>"
uvx harbor dataset add "<path/to/task-a>" "<path/to/task-b>"   # local tasks from elsewhere
uvx harbor dataset add "<path/to/folder>" --scan                 # all tasks in another folder
uvx harbor dataset add org/task-name                             # published tasks from registry
uvx harbor dataset add org/dataset-name                          # all tasks from a published dataset
uvx harbor dataset add metric.py                                 # metric file (same dir as dataset.toml)
uvx harbor dataset remove "<org>/<task-name>"                     # remove a task
```

Specific versions: `org/task@tag`, `org/task@revision`, or `org/task@sha256:<hash>`.

### 3. Sync digests (if tasks/metrics changed since last publish)

```bash
uvx harbor sync
uvx harbor sync --upgrade   # also upgrade remote tasks to latest
```

### 4. Publish the dataset

```bash
uvx harbor publish "<path/to/dataset>"
```

`uvx harbor publish` automatically refreshes digests of local tasks in the dataset directory.

## Publish options (tasks and datasets)

- `-t / --tag`: add tags (repeatable). `latest` is always included.
- `-c / --concurrency`: control upload concurrency.
- `--public`: make public (private by default).
- `--no-tasks` (datasets only): skip publishing tasks in the dataset directory.

Example:
```bash
uvx harbor publish "<path>" -t v1.0 --public
```

## After publishing

- Visibility can be changed later with `uvx harbor task visibility` / `uvx harbor dataset visibility` or on https://hub.harborframework.com/.
- Run a published dataset with:
  ```bash
  uvx harbor run -d "<org>/<dataset>@v1.0" -a "<agent>" -m "<model>"
  ```
