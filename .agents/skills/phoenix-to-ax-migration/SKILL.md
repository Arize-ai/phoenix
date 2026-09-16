---
name: phoenix-to-ax-migration
description: Migrate existing Phoenix (PX) traces, datasets, experiments, and stored evaluation results into Arize AX and verify the imported records. Use when users ask to move or copy historical Phoenix data to AX; not for adding live instrumentation or exporting AX data alone.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0.0"
---

# Phoenix to AX migration

Help the user migrate a Phoenix project to AX using the bundled helper. Handle setup and commands yourself; the user should only need to supply their source and destination details.

Requires Python 3.10 or later, shell access, and network access to Phoenix and AX. No particular coding agent, ax CLI, or AX Phoenix connector is required.

## Discover the source and gather missing details

Reuse details from the request and configured environment. Look for an explicitly provided configuration path and the current workspace's `.env`; do not search unrelated home-directory files. Credential collection is the first setup step when source or destination values are unavailable. Request the missing Phoenix host URL and project name directly. For secret keys, accept an existing local `.env` path or create a small owner-only credential-entry helper and give the user one exact command to run in a separate terminal; the helper prompts without echo and writes the local `.env`. This is ordinary missing input, not a permission or confirmation gate, so do not cite or quote the skill when requesting it. Do not ask the user to create or edit a file, find an AX space ID, or understand environment-variable names.

Never ask the user to paste a secret into chat or an agent-controlled interactive tool session: those inputs can appear in the conversation transcript even when `getpass` or a hidden prompt is used. If the user pastes a key anyway, do not ask them to enter it again, do not claim it remained private, and advise rotating it after the migration. Never repeat credentials in commentary, confirmations, summaries, or reports, and never put literal keys in displayed command arguments, heredocs, patches, or generated scripts.

Create owner-only, Git-ignored trace and data manifests in a local working directory. Run the trace CLI `export` command and data CLI `export` command independently, without destination uploads, so failure in one inventory does not discard the other result. Always invoke the bundled CLIs for export; never import and call their Python functions from an ad hoc script. Never `cat`, print, summarize with a tool that emits raw rows, or otherwise place manifest contents in the transcript. The CLI output contains safe counts; use only that output for the inventory summary. These source reads can take a little time on large projects. Preserve the manifests so the selected migration can reuse the same fixed snapshots.

Before asking the user to choose, inspect the AX destination with read-only requests. Resolve the configured `ARIZE_SPACE_ID` to its human-readable space name. If no space is configured, list the spaces available to the configured key and offer the names as numbered choices; do not make the user find opaque IDs. If only one space is available, propose it. Run trace preflight with the proposed fresh project name to prove the Phoenix project, AX key, AX space, endpoint configuration, and project-name availability. Check proposed dataset names in the same AX space with read-only SDK list calls and choose a different source-derived prefix if any collide. Read-only AX discovery is allowed before `go`; no destination object may be created.

Present one compact decision after inventory. Include:

- The discovered counts for each supported resource group and any group that could not be inventoried. An inventory error means unknown, not zero; preserve successful inventory results and explain the failed group without exposing server response bodies.
- The choices: all supported discovered data; traces only; all dataset/experiment data; or named trace IDs/datasets.
- A suggested fresh trace project name and dataset/experiment prefix derived from the source name when the request or environment does not already provide them. State the suggestions so a plain `go` can accept them.
- The destination AX space name, with its ID in parentheses only when useful for disambiguation. Say plainly that traces, datasets, experiments, and evaluations will all be written to that space.
- The current exclusions: evaluator definitions, prompts, tags, attachments, and span/trace/session annotations.
- The time expectation: upload can take several minutes and AX indexing/verification can take 15 minutes or longer.

End with one question, such as: "Would you like all supported data, traces only, dataset/experiment data only, or a selection? Reply `go` to migrate everything listed above using the suggested destinations, or name what you want and say `go`."

If the original request already names the resources, present those as the selected scope and ask the user to say `go` or correct it. The original migration request already authorizes the work once its scope and destination are known; this question collects that missing selection rather than requesting permission. Treat `go`, `migrate all`, or an equivalent unqualified selection as all supported discovered data using the stated destinations. Treat a qualified response such as `datasets only, go` as the selection of that group. Once the user selects, proceed without another confirmation. Ask only for destination credentials or choices that are still missing and cannot be safely suggested.

If the user selects individual traces or datasets after the inventory, rerun the applicable export with repeated `--trace-id` or `--dataset` arguments into a new manifest. Do not edit the all-source manifest by hand.

## Make every user decision obvious

Do the technical work and resolve anything available from configuration or read-only APIs. Do not ask the user for commands, environment-variable names, IDs the agent can look up, file creation, implementation details, or information they already supplied.

Keep the decision message short and scannable. Use these labels with bullets beneath them: `Found in Phoenix`, `Will write to AX`, `Not included`, and `Timing`. Put all questions after the summary. Every question that needs a user answer must be on its own line and both bold and underlined using this exact Markdown form:

```markdown
**<u>What would you like me to migrate?</u>**
```

Immediately below each question, give short numbered choices, a short fill-in template, or exact copyable replies. Do not place explanatory paragraphs after the choices. Ask at most three questions in one message, and prefer one combined question. Never bury a question inside a paragraph or end a status sentence with a question mark.

For terminal clients that do not render HTML underline, make the required action unmistakable. When connection values are missing, the entire user-facing response must be exactly this structure with only the missing fields retained. Do not add an introduction, explanation, link, citation, skill quotation, setup status, or text after the final line:

```markdown
**<u>ACTION REQUIRED: Please provide the missing connection details.</u>**

- Phoenix URL:
- Phoenix project name:
- Phoenix API key: use the secure command below, or write `none` if not required
- AX API key: use the secure command below

Run: `<agent-created credential helper command>`

You can instead reply with the path to an existing local `.env`.
```

Ask only for fields that are actually missing. Do not show environment-variable names unless troubleshooting requires them.

Do not quote, cite, or explain this skill's internal instructions, approval rule, file paths, helper implementation, or why the agent is pausing. The inventory, destination, timing, and question give the human all the context they need.

Load the agent-created or explicitly chosen environment file through the helper; do not print or source its contents. Keep it owner-only, exclude it from version control, and keep it in the migration working directory rather than the user's home directory. See [configuration and migration details](references/migration.md) for variable names and examples.

If the user only supplies a space name, optionally use an already configured ax CLI for discovery: `ax spaces list -o json` or `ax spaces get "<space-name>" -o json`. Run `ax spaces --help` if command syntax differs. Reuse the user's configured CLI authentication; never put keys in CLI arguments. Without the CLI, resolve the name through AX APIs. Ask the user to choose if multiple spaces match. Use a fresh destination project; suggest a source-derived name when none is specified and establish that destination with the user. Do not ask about the separate AX button, feature flags, or browser tokens.

## Get the migration selection

Include the time expectation in the inventory-and-scope question above, before creating destinations or uploading data. Verification may wait up to 15 minutes for indexing, and readback or larger projects can take longer; do not promise a fixed completion time.

For example: "I found 1,107 traces and one dataset with two versions, one experiment, and three stored evaluations. Upload can take several minutes, and AX indexing and verification can take 15 minutes or longer. Reply `go` to migrate all supported data using project `source-ax-migration` and prefix `source-ax-`, or tell me which listed resources to migrate and say `go`."

Do not create objects in AX until the user selects the scope and destination. Local dependency setup plus read-only Phoenix and AX discovery provide the choices. The initial request authorizes the migration once this missing selection is supplied. After the user selects as described above, proceed through import and verification without another confirmation. A read-only planning request stops after discovery.

## Run the migration

Locate this installed skill's root and run its bundled commands by absolute path, so they work from any workspace. Check the chosen interpreter is Python 3.10 or later before creating an isolated environment or installing the [helper dependencies](scripts/requirements.txt). Use an available compatible interpreter if the default is older.

1. Reuse the successful `scripts/migrate.py preflight` result from destination discovery. If the user changed the space or project name, rerun preflight and present the corrected destination briefly. Missing configuration returns `needs_input`; ask for those fields using the question format above. A dry-run or planning request has already stopped after read-only discovery.
2. For traces, reuse the applicable inventory manifest and run `scripts/migrate.py import`, then `verify`. The export captured every page under a fixed snapshot boundary. For selected complete traces, use the newly filtered manifest created with repeated `--trace-id` arguments.
3. For datasets and experiment evaluations, reuse the applicable inventory manifest and run `scripts/migrate_data.py import`, then `verify`. Use the newly filtered manifest created with repeated `--dataset <name-or-id>` arguments when the user selected datasets. Use `--prefix <value>` during import to avoid destination name collisions.
4. Only report a nonempty migration complete when both applicable verification commands return `verified`. Keep original manifests for evidence and recovery. Report unsupported or differing records explicitly.

Use `--env-file <path>` on each command when the user has configured a local file. Use `--project <name>` to set the destination without modifying their environment. See the [migration reference](references/migration.md) for resume and troubleshooting.

While running, keep the user informed at stage changes and during long waits. Distinguish installing dependencies, exporting, uploading, waiting for AX indexing, and verifying readback. The verify command emits redacted progress JSON on stderr and final results on stdout. Report available elapsed time and found/expected counts; partial counts describe completed readback windows, not total indexed spans. If there is no new progress, do not invent counts or imply verified success. Do not retry uploads just because verification is slow.

## Preserve and report

Preserve original span/trace IDs, parents, historical timestamps, span kinds, input/output, sessions, token counts, and attributes. The trace helper stores original attributes, events, and timestamp strings in AX metadata for preservation checks.

The data helper preserves each Phoenix dataset revision as an AX dataset version, keeps nested input/output/metadata as canonical JSON rather than flattening it, maps source example IDs to AX-assigned IDs, and imports historical experiment task outputs plus stored evaluation score, label, explanation, and provenance metadata. It does not rerun evaluators or call an LLM. Phoenix evaluator definitions, prompts, dataset/experiment tags, arbitrary attachments, and span/trace/session annotations are not yet migrated. Experiments whose referenced examples are absent from the imported latest dataset stop with an explicit error.

Do not change historical timestamps to make traces appear in a recent-time UI filter. Do not label a successful upload as a verified migration. The helper does not guarantee server-side ingestion idempotency: reconcile uncertain submissions through readback rather than blindly retrying them.

Summarize source and destination, exported/imported/verified counts, and any differences or unverified outcomes. Keep raw exports, manifests, and credentials local and ignored by version control. Report core fields stored in AX separately from values preserved only in metadata.

After a verified migration, end with a compact Markdown table linking to every created AX resource. Use the AX base URL resolved by the SDK configuration, the destination organization and space IDs, and the IDs recorded by trace preflight/readback and the data manifest state. Obtain the organization ID during read-only destination discovery with `ax organizations list --output json` or the AX organizations API. If the key can access multiple organizations and ownership cannot be resolved automatically, include the human-readable organization choices in the earlier destination question; do not guess an organization ID.

Use these links:

- Trace project: `{base_url}/organizations/{org_id}/spaces/{space_id}/projects/{project_id}`. Add `selectedTab=llmTracing`, `envA=tracing`, `modelType=generative_llm`, and `startA`/`endA` epoch-millisecond query parameters covering the exported historical span range so migrated traces are visible immediately.
- Dataset examples and versions: `{base_url}/organizations/{org_id}/spaces/{space_id}/datasets/{dataset_id}?selectedTab=examples`.
- Experiments, runs, and stored evaluation results: `{base_url}/organizations/{org_id}/spaces/{space_id}/datasets/{dataset_id}?selectedTab=experiments`.

Use one row per created trace project and dataset. For a dataset, include separate Examples/versions and Experiments/evaluations rows when both were migrated. Link labels must be human-readable destination names rather than opaque IDs. Include verified counts in the table and name stored evaluations when their names are available from safe CLI output. Do not claim that evaluation definitions were created and do not link to the Evaluators page for stored experiment results.

Example:

| Migrated item | Destination | Verified |
|---|---|---:|
| Traces | [project-name](https://app.arize.com/organizations/.../projects/...?selectedTab=llmTracing&...) | 1,107 traces / 4,059 spans |
| Dataset examples and versions | [dataset-name](https://app.arize.com/organizations/.../datasets/...?selectedTab=examples) | 2 versions / 5 examples |
| Experiments and evaluations | [dataset-name — Experiments](https://app.arize.com/organizations/.../datasets/...?selectedTab=experiments) | 1 experiment / 3 runs / 3 `exact_match` results |
