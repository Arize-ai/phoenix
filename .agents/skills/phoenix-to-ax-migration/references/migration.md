# Migration configuration and behavior

## Configuration

The agent reads source and destination configuration using the variable names in the [user setup README](../README.md). Reuse an existing credential file; do not embed secrets in commands, scripts, edit diffs, or tool requests. If credentials are missing, ask the user to configure them privately.

An explicit `--env-file` loads these values without executing shell code. Environment variables override file values; `--project` overrides the destination name. Public unauthenticated Phoenix does not need a key. An authenticated Phoenix URL must use HTTPS; redirects are not followed with credentials.

AX API readback uses `https://api.arize.com/v2` by default. Both REST readback and uploads use the same SDK-resolved endpoint configuration: `ARIZE_API_HOST`, `ARIZE_API_PORT`, `ARIZE_API_SCHEME`, `ARIZE_SINGLE_HOST`, `ARIZE_SINGLE_PORT`, `ARIZE_BASE_DOMAIN`, and `ARIZE_REGION`. SDK precedence and mutually exclusive region/single-endpoint/base-domain rules apply; HTTPS is required. Read and upload permissions are checked by actual requests; a read-only preflight cannot prove ingestion permission. API-key GraphQL access to the separate Phoenix connector is unnecessary.

## Commands

Use the installed skill's absolute path in place of `$SKILL_ROOT`:

```bash
python -m venv .venv-phoenix-migration
.venv-phoenix-migration/bin/python -m pip install -r "$SKILL_ROOT/scripts/requirements.txt"
.venv-phoenix-migration/bin/python "$SKILL_ROOT/scripts/migrate.py" preflight --env-file .env --project my-fresh-project
.venv-phoenix-migration/bin/python "$SKILL_ROOT/scripts/migrate.py" export --env-file .env --manifest migration-local/snapshot.json
.venv-phoenix-migration/bin/python "$SKILL_ROOT/scripts/migrate.py" import --env-file .env --manifest migration-local/snapshot.json --project my-fresh-project
.venv-phoenix-migration/bin/python "$SKILL_ROOT/scripts/migrate.py" verify --env-file .env --manifest migration-local/snapshot.json
```

Add the virtual environment and `migration-local/` to the workspace's ignore rules. On Windows, use the virtual environment's `Scripts/python.exe` path.

All commands print JSON without raw payloads or credentials. Exit codes: `0` for a completed operation, `1` for an error, `2` for missing configuration, and `3` for verification that did not establish success. An import result of `uploaded_unverified` still requires the verify command.

## Data and verification

The helper exports paginated Phoenix JSON under one UTC upper bound. Selection by trace ID scans the snapshot to include all of that trace's spans. A snapshot is not a database transaction; concurrent source deletion or backdated ingestion can affect consistency. Do not modify the source during a migration that requires exact counts.

Core span fields and known OpenInference attributes become AX batch columns. Indexed message/tool attributes are assembled into SDK list structures. Original attributes, events, and timestamp strings are also stored as a JSON preservation record under `attributes.metadata.phoenix_migration`; this is preservation storage, not a promise that every Phoenix field has a first-class AX dashboard column. Source metadata using the reserved `phoenix_migration` key is rejected to avoid overwriting it.

Verification checks span ID sets, trace IDs, parent IDs, names, start/end times, kind/status, core input/output/session/token/model/tool attributes, and the preservation copy. Timestamp conversion uses integer nanoseconds, including fractional seconds up to nine digits. AX REST timestamp readback was observed to differ by up to 128 ns; verification reports the maximum difference, permits at most 128 ns in first-class timestamp readback, and separately requires the original timestamp strings in metadata to match exactly. Numeric Phoenix session IDs become AX strings, and token counts returned as strings are compared by their integer representation. Readback uses the source's historical time window, not the default recent window. AX cursor pagination was observed to omit historical records, so verification recursively splits truncated results into disjoint millisecond windows instead of following span cursors. It stops if more than 500 spans share one millisecond or verification exceeds 4096 requests, rather than claiming completeness. Field differences report names and counts, never raw values.

Full export is held in memory and saved as one local manifest, so v1 is intended for projects that fit comfortably in local memory. It rejects conflicting duplicate source IDs and repeated pagination cursors instead of silently truncating results. Raw manifests contain trace payloads; files are created with local owner-only permissions.

## Resume and failures

Imports default to 500 spans per batch. `--max-batches 1` pauses after one submitted batch; rerun import with the same manifest and destination to continue. Already submitted batches are skipped. Do not delete a manifest or change its destination to resume an upload.

The manifest records a batch as uncertain before submitting it. If the process dies or loses the response, rerunning import stops at that batch. Run verify first. A fully matching destination reconciles the manifest; a partial match remains unverified and requires investigation rather than automatic resubmission. The helper makes no duplicate-free retry guarantee for AX ingestion.

Verification polls every 15 seconds for up to 900 seconds. `--wait-seconds 0` makes one readback attempt. Missing records can reflect indexing delay, retention limits, or a failed upload. Report the result accurately and rerun verification later without reuploading.

HTTP 401/403 requires fixing credentials or permissions. HTTP 429/5xx and connection failures on read-only requests use four bounded attempts. Unexpected redirects, invalid JSON, and other HTTP failures stop the operation. Definite authentication and other client-side upload rejections return the batch to pending so the user can fix the problem and rerun import. HTTP 408/5xx and transport failures remain uncertain because acceptance cannot be established; run verification before retrying. No upload is retried automatically.


## Progress and permission failures

The verify CLI writes throttled redacted progress JSON to stderr and one final result JSON to stdout. Progress includes stage, elapsed seconds, expected spans, and spans accumulated from completed disjoint query windows. Those partial counts are not the total indexed count; they reset for each polling attempt. Use them for updates without displaying trace payloads or keys.

Phoenix project/export and AX destination/readback failures identify the service and stage. A key with read but no ingestion permission fails upload and leaves a definitely rejected batch pending. A key without destination read permission cannot pass preflight or start import, even if it has ingestion permission. If spans were already submitted and verification receives HTTP 401/403 or a missing/inaccessible destination returns 404, report uploaded_unverified with the readback error and keep the manifest for verification after credentials are corrected. Never infer ingestion permission from preflight or verified success from an accepted upload.

An empty snapshot returns empty with zero counts and no API request or destination creation for import/verify. It is a no-upload outcome, not a verified nonempty migration. Local manifests are checksum-validated even in this case.
## Dataset and experiment evaluation commands

Use a separate manifest for non-trace data:

```bash
python scripts/migrate_data.py export --env-file /private/path/.env --manifest /private/path/data.json
python scripts/migrate_data.py import --env-file /private/path/.env --manifest /private/path/data.json --prefix migrated-
python scripts/migrate_data.py verify --env-file /private/path/.env --manifest /private/path/data.json
```

Repeat `--dataset <name-or-id>` during export to select datasets. With no selection, all Phoenix datasets are exported. The export walks dataset versions oldest to newest and includes each version's full example snapshot, experiments, task runs, and stored evaluation runs. The manifest is checksummed and owner-only.

AX assigns new dataset example and experiment run IDs. The helper stores Phoenix IDs in destination fields, builds the required ID mapping, and verifies relationships through AX readback. Nested input, output, and metadata remain separate canonical JSON strings to prevent leaf-name collisions. Evaluation results become native `eval.<name>.score`, `label`, and `explanation` fields; Phoenix provenance remains evaluation metadata.

The import requires a nonempty initial dataset version and at least one retained example between successive versions so AX can fork version history. It stops rather than silently flattening data or dropping a revision. Phoenix's client exposes at most 100 dataset versions without a continuation cursor, so the helper stops when that boundary is reached rather than risk an incomplete export. Destination dataset and experiment names must be fresh; use `--prefix` when appropriate.

The helper checkpoints destination IDs and version mappings in the manifest. If a request fails or its response is lost, rerun the same import command with the same manifest and prefix. It reconciles destination objects by their recorded IDs and deterministic migration names, and reads the current version contents before applying only the remaining changes. Do not delete or edit the manifest between attempts.

This workflow does not execute evaluators or incur model costs. It does not currently migrate evaluator definitions, prompts, tags, attachments, or span/trace/session annotations.
