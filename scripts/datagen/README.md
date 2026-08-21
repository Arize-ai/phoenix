# Trace scenario recorder

These scripts record deterministic scenario traffic through real OpenInference instrumenters. The
result is checked-in OTLP protobuf JSON that can be replayed without installing the scenario
frameworks at runtime.

From the repository root, start the keyless mock provider:

```console
python scripts/datagen/mock_openai_provider.py
```

In another shell, record both scenarios with their isolated PEP 723 environments:

```console
OPENAI_API_KEY=datagen-dummy-key \
  OPENAI_BASE_URL=http://127.0.0.1:8765/v1 \
  uv run scripts/datagen/openai_chat_sessions.py
OPENAI_API_KEY=datagen-dummy-key \
  OPENAI_BASE_URL=http://127.0.0.1:8765/v1 \
  uv run scripts/datagen/langchain_agent_rag.py
```

Each script replaces its scenario's `traces.jsonl` and `manifest.json`. Every JSONL line is one
protobuf-JSON `ExportTraceServiceRequest`; requests from a multi-span trace may occupy multiple
lines. The mock provider never contacts an external service.

Re-record and review the scenario assets whenever a pinned instrumenter version changes. This
version-bump workflow is the freshness mechanism for keeping stored span shapes aligned with
upstream instrumentation.

## Publishing a full scenario bank

Full banks are distributed as checksum-pinned GitHub release assets. Package an accepted
generation run with `package_generation_run` from `scripts.datagen.bank`, then upload the resulting
`<scenario-name>.tar.gz` file as the only file in a workflow artifact. Keep the source workflow run
ID and artifact name; the publication workflow downloads that immutable input rather than running
generation again.

Run the **Publish datagen assets** workflow with a unique lowercase `pass_id`, the source workflow
run ID, the artifact name, and the exact archive filename. A pass named `20260821-01` creates the
plain release tag and name `datagen-assets-20260821-01`. The archive is uploaded under its original
`<scenario-name>.tar.gz` filename, and the release is explicitly excluded from GitHub's latest
release selection.

Before any release is created, the workflow requires exactly one downloaded file and validates the
complete bank with `read_v2_bank`. This checks the canonical archive layout, manifest schema,
per-file digests and sizes, trace membership, and manifest counts. It also verifies that the
archive filename matches the manifest scenario name and that the staged index entry can be loaded
through Phoenix's runtime index parser. Any mismatch stops the pass before release mutation.

The workflow writes the validated counts, revision, matrix digest, archive digest, and archetypes to
both the release notes and the GitHub Actions step summary. It also uploads a
`datagen-assets-<pass_id>-index-update` artifact containing:

```text
asset-index.patch
generation-summary.md
release-metadata.json
src/phoenix/datagen/assets/index.json
```

Use the complete index file at its in-tree path as the input to the next application release. The
unified patch is included as a reviewer aid. The entry points to the immutable release URL and pins
the archive SHA-256 and byte size; do not edit those values independently of the published asset.
