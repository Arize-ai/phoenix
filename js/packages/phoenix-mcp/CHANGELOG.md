# @arizeai/phoenix-mcp

## 4.2.5

### Patch Changes

- Updated dependencies [a6c3f88]
  - @arizeai/phoenix-client@7.0.1

## 4.2.4

### Patch Changes

- Updated dependencies [4867e34]
  - @arizeai/phoenix-client@7.0.0

## 4.2.3

### Patch Changes

- @arizeai/phoenix-client@6.14.2

## 4.2.2

### Patch Changes

- @arizeai/phoenix-client@6.14.1

## 4.2.1

### Patch Changes

- Updated dependencies [d6b1cbb]
  - @arizeai/phoenix-client@6.14.0

## 4.2.0

### Minor Changes

- f94067b: Add px setup script for agent onboarding

### Patch Changes

- Updated dependencies [f94067b]
  - @arizeai/phoenix-client@6.13.0
  - @arizeai/phoenix-config@0.4.0

## 4.1.1

### Patch Changes

- c0ab6a9: Add `.env.phoenix` file discovery as a fallback source for Phoenix configuration. When a setting is not present in the process environment, `@arizeai/phoenix-config` walks up from the current working directory to the nearest `.env.phoenix` file and reads `PHOENIX_`-prefixed keys from it (dotenv format). Process environment values take precedence, and related settings (credentials, OTel endpoint/port) are resolved as a group from a single source. Files not owned by the current user are ignored, with one-time warnings for skipped files, for files accessible to other users, and for endpoints paired with credentials from a different source. Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery; call `clearEnvFileCache()` to refresh cached results. Browser builds use a Node-free implementation selected through a conditional package export. `@arizeai/phoenix-cli` ranks discovered values below configured profiles; `@arizeai/phoenix-mcp` and `@arizeai/phoenix-otel` read `.env.phoenix` values through the shared resolution.
- Updated dependencies [c0ab6a9]
  - @arizeai/phoenix-config@0.3.0
  - @arizeai/phoenix-client@6.12.2

## 4.1.0

### Minor Changes

- 1e7d9fc: Unify the project-name environment variable across the TypeScript packages: every surface now reads both `PHOENIX_PROJECT` (canonical) and `PHOENIX_PROJECT_NAME` (supported alias), with `PHOENIX_PROJECT` taking precedence and explicit args/flags still winning over both. When both are set to conflicting values, the canonical value is used and a one-time warning naming both values is emitted. `@arizeai/phoenix-config` is the single home for this resolution: it exposes the shared `getProjectFromEnvironment()` resolver and includes the resolved project in `getEnvironmentConfig()`. `@arizeai/phoenix-cli`, `@arizeai/phoenix-mcp`, and `@arizeai/phoenix-otel` all consume it — `@arizeai/phoenix-otel` now depends on `@arizeai/phoenix-config` and its `register()` falls back to these variables (via the shared resolver) when no `projectName` is passed, rather than duplicating the logic.

### Patch Changes

- Updated dependencies [1e7d9fc]
  - @arizeai/phoenix-config@0.2.0
  - @arizeai/phoenix-client@6.12.1

## 4.0.19

### Patch Changes

- Updated dependencies [7947440]
  - @arizeai/phoenix-client@6.12.0

## 4.0.18

### Patch Changes

- Updated dependencies [7afa183]
  - @arizeai/phoenix-client@6.11.2

## 4.0.17

### Patch Changes

- Updated dependencies [a027ada]
  - @arizeai/phoenix-client@6.11.1

## 4.0.16

### Patch Changes

- Updated dependencies [7efabf6]
  - @arizeai/phoenix-client@6.11.0

## 4.0.15

### Patch Changes

- 4ce1b7d: Send an explicit `User-Agent: phoenix-mcp` header on Phoenix REST requests. Node's global `fetch` (undici) defaults to `User-Agent: undici`, which some Phoenix Cloud edges 302-redirect to an HTML landing page, causing tool calls to fail with `Unexpected token < in JSON`. Caller-supplied headers still take precedence (#13742).

## 4.0.14

### Patch Changes

- Updated dependencies [0347f22]
  - @arizeai/phoenix-client@6.10.1

## 4.0.13

### Patch Changes

- Updated dependencies [6dceb10]
  - @arizeai/phoenix-client@6.10.0

## 4.0.12

### Patch Changes

- @arizeai/phoenix-client@6.9.3

## 4.0.11

### Patch Changes

- Updated dependencies [d0cc4c4]
  - @arizeai/phoenix-client@6.9.2

## 4.0.10

### Patch Changes

- 5d14f23: Add LinkedIn link to the Community section of the README.
- Updated dependencies [5d14f23]
  - @arizeai/phoenix-config@0.1.4
  - @arizeai/phoenix-client@6.9.1

## 4.0.9

### Patch Changes

- Updated dependencies [2993b04]
- Updated dependencies [4e20267]
- Updated dependencies [2993b04]
  - @arizeai/phoenix-client@6.9.0

## 4.0.8

### Patch Changes

- Updated dependencies [e381885]
- Updated dependencies [187df7e]
  - @arizeai/phoenix-client@6.8.1

## 4.0.7

### Patch Changes

- Updated dependencies [a4dad8b]
  - @arizeai/phoenix-client@6.8.0

## 4.0.6

### Patch Changes

- Updated dependencies [e19a038]
  - @arizeai/phoenix-client@6.7.0

## 4.0.5

### Patch Changes

- Updated dependencies [8444575]
  - @arizeai/phoenix-client@6.6.2

## 4.0.4

### Patch Changes

- Updated dependencies [1449f3d]
  - @arizeai/phoenix-client@6.6.1

## 4.0.3

### Patch Changes

- Updated dependencies [c70eca6]
  - @arizeai/phoenix-client@6.6.0

## 4.0.2

### Patch Changes

- Updated dependencies [1028be5]
  - @arizeai/phoenix-client@6.5.5

## 4.0.1

### Patch Changes

- b4ded15: Update package READMEs with latest capabilities

  - phoenix-client: Add Sessions section documenting `listSessions`, `getSession`, and `addSessionAnnotation`
  - phoenix-evals: Add full pre-built evaluators table (conciseness, correctness, document relevance, refusal, tool evaluators), fix import paths for `bindEvaluator`
  - phoenix-mcp: Expand Tool Coverage section with complete, accurate tool list
  - phoenix-config: Full documentation replacing the one-line placeholder (installation, environment variables, usage examples)
  - phoenix-cli: Add `px annotation-config` command documentation

- Updated dependencies [b4ded15]
  - @arizeai/phoenix-client@6.5.4
  - @arizeai/phoenix-config@0.1.3

## 4.0.0

### Major Changes

- e4bdcf6: Expand phoenix-mcp server coverage with breaking parameter changes

  ### Breaking changes

  - Tool parameters renamed to snake_case (`datasetIdentifier` → `dataset_id`/`dataset_name`, `experiment_id` replaces `experiment_id`, `prompt_identifier`, `project_identifier`, etc.)
  - `resolveTraceIdByPrefix` removed — `get-trace` now requires an exact trace ID
  - Legacy identifier fallback patterns removed (`requirePreferredIdentifier`, `legacyProjectIdentifier`)

  ### New tools

  - `list-projects`, `get-project`, `list-traces`, `get-trace`, `get-spans`, `get-span-annotations`
  - `list-sessions`, `get-session`, `list-annotation-configs`, `phoenix-support`
  - `get-prompt-version-by-tag`, `list-prompt-version-tags`, `add-prompt-version-tag`

  ### Improvements

  - Generic `fetchAllPages` pagination helper replaces duplicated cursor loops
  - Centralized constants, deduplicated `extractSpanIds`, cached RunLLM client
  - `ENV_PHOENIX_PROJECT` moved to `@arizeai/phoenix-config` for reuse

### Patch Changes

- Updated dependencies [e4bdcf6]
  - @arizeai/phoenix-config@0.1.2
  - @arizeai/phoenix-client@6.5.3

## 3.1.5

### Patch Changes

- Updated dependencies [d204898]
  - @arizeai/phoenix-client@6.5.2

## 3.1.4

### Patch Changes

- Updated dependencies [91949d7]
  - @arizeai/phoenix-client@6.5.1

## 3.1.3

### Patch Changes

- Updated dependencies [9769f90]
  - @arizeai/phoenix-client@6.5.0

## 3.1.2

### Patch Changes

- Updated dependencies [83b7f68]
  - @arizeai/phoenix-client@6.4.0

## 3.1.1

### Patch Changes

- Updated dependencies [d951320]
  - @arizeai/phoenix-client@6.3.0

## 3.1.0

### Minor Changes

- 6d896e3: Add `traceIds` parameter to `getSpans` and MCP `get-spans` tool for filtering spans by trace ID.

### Patch Changes

- Updated dependencies [6d896e3]
  - @arizeai/phoenix-client@6.2.0

## 3.0.1

### Patch Changes

- Updated dependencies [b8ba989]
- Updated dependencies [6296d0a]
- Updated dependencies [6296d0a]
  - @arizeai/phoenix-client@6.1.0

## 3.0.0

### Major Changes

- 03b10a8: feat: upgrade zod from v3 to v4

  BREAKING CHANGE: Upgraded zod from v3 to v4. This changes inferred TypeScript types
  for schemas using `z.looseObject()` (previously `.passthrough()`) which now include
  `[x: string]: unknown` in their output types. Consumers using these types may need
  to update their code. Additionally, `ZodError.errors` has been replaced with
  `ZodError.issues`, `z.record()` now requires explicit key schemas, and
  `zod-to-json-schema` has been replaced with native `z.toJSONSchema()`.

### Patch Changes

- Updated dependencies [03b10a8]
  - @arizeai/phoenix-client@6.0.0

## 2.3.7

### Patch Changes

- Updated dependencies [db24319]
- Updated dependencies [b18325b]
  - @arizeai/phoenix-client@5.9.0

## 2.3.6

### Patch Changes

- Updated dependencies [8be1940]
  - @arizeai/phoenix-client@5.8.2

## 2.3.5

### Patch Changes

- @arizeai/phoenix-client@5.8.1

## 2.3.4

### Patch Changes

- Updated dependencies [af4dc46]
  - @arizeai/phoenix-client@5.8.0

## 2.3.3

### Patch Changes

- Updated dependencies [01eb1fb]
  - @arizeai/phoenix-client@5.7.0

## 2.3.2

### Patch Changes

- Updated dependencies [ed59696]
  - @arizeai/phoenix-client@5.6.1

## 2.3.1

### Patch Changes

- Updated dependencies [0f2950e]
  - @arizeai/phoenix-client@5.6.0

## 2.3.0

### Minor Changes

- 5362ed2: Fix support tool endpoint

### Patch Changes

- Updated dependencies [5132ce4]
  - @arizeai/phoenix-client@5.5.5

## 2.2.30

### Patch Changes

- 4208604: trigger changeset publish
- Updated dependencies [4208604]
  - @arizeai/phoenix-client@5.5.4

## 2.2.29

### Patch Changes

- c96475c: trigger changeset publish
- Updated dependencies [c96475c]
  - @arizeai/phoenix-client@5.5.3

## 2.2.28

### Patch Changes

- 857b617: add links to packages
- Updated dependencies [857b617]
  - @arizeai/phoenix-client@5.5.2

## 2.2.27

### Patch Changes

- @arizeai/phoenix-client@5.5.1

## 2.2.26

### Patch Changes

- Updated dependencies [cb45336]
  - @arizeai/phoenix-client@5.5.0

## 2.2.25

### Patch Changes

- Updated dependencies [b87d2a4]
  - @arizeai/phoenix-client@5.4.1

## 2.2.24

### Patch Changes

- Updated dependencies [885be2a]
  - @arizeai/phoenix-client@5.4.0

## 2.2.23

### Patch Changes

- Updated dependencies [b000189]
- Updated dependencies [557865c]
- Updated dependencies [0c92232]
  - @arizeai/phoenix-client@5.3.0

## 2.2.22

### Patch Changes

- @arizeai/phoenix-client@5.2.1

## 2.2.21

### Patch Changes

- Updated dependencies [f9d8b06]
  - @arizeai/phoenix-client@5.2.0

## 2.2.20

### Patch Changes

- @arizeai/phoenix-client@5.1.1

## 2.2.19

### Patch Changes

- Updated dependencies [de6f111]
  - @arizeai/phoenix-client@5.1.0

## 2.2.18

### Patch Changes

- Updated dependencies [950fda5]
  - @arizeai/phoenix-client@5.0.0

## 2.2.17

### Patch Changes

- Updated dependencies [85430fa]
- Updated dependencies [c7cc7d9]
  - @arizeai/phoenix-client@4.2.0

## 2.2.16

### Patch Changes

- Updated dependencies [2981780]
  - @arizeai/phoenix-client@4.1.0

## 2.2.15

### Patch Changes

- Updated dependencies [e3a8ce2]
- Updated dependencies [c85780b]
  - @arizeai/phoenix-client@4.0.3

## 2.2.14

### Patch Changes

- Updated dependencies [1b71c66]
  - @arizeai/phoenix-client@4.0.2

## 2.2.13

### Patch Changes

- Updated dependencies [e72a9ad]
  - @arizeai/phoenix-client@4.0.1

## 2.2.12

### Patch Changes

- Updated dependencies [7732f99]
  - @arizeai/phoenix-client@4.0.0

## 2.2.11

### Patch Changes

- Updated dependencies [4f43901]
  - @arizeai/phoenix-client@3.2.0

## 2.2.10

### Patch Changes

- Updated dependencies [ee0c829]
  - @arizeai/phoenix-client@3.1.0

## 2.2.9

### Patch Changes

- Updated dependencies [8711bde]
- Updated dependencies [3e80a50]
  - @arizeai/phoenix-client@3.0.0

## 2.2.8

### Patch Changes

- Updated dependencies [fe55fc5]
  - @arizeai/phoenix-client@2.4.0

## 2.2.7

### Patch Changes

- Updated dependencies [83748e6]
  - @arizeai/phoenix-client@2.3.5

## 2.2.6

### Patch Changes

- a045486: update phoenix-support-mcp

## 2.2.5

### Patch Changes

- Updated dependencies [20db91d]
  - @arizeai/phoenix-client@2.3.4

## 2.2.4

### Patch Changes

- 2609fcd: bump target JS to es2017 for native async
- Updated dependencies [2609fcd]
  - @arizeai/phoenix-client@2.3.3

## 2.2.3

### Patch Changes

- Updated dependencies [6ef8e47]
  - @arizeai/phoenix-client@2.3.2

## 2.2.2

### Patch Changes

- Updated dependencies [b3e30db]
  - @arizeai/phoenix-client@2.3.1

## 2.2.1

### Patch Changes

- Updated dependencies [3c97cc7]
  - @arizeai/phoenix-client@2.3.0

## 2.2.0

### Minor Changes

- 468f77b: add phoenix-support tool

## 2.1.11

### Patch Changes

- Updated dependencies [1906611]
- Updated dependencies [4c52db4]
  - @arizeai/phoenix-client@2.2.0

## 2.1.10

### Patch Changes

- Updated dependencies [5dd53be]
  - @arizeai/phoenix-client@2.1.1

## 2.1.9

### Patch Changes

- Updated dependencies [b162720]
  - @arizeai/phoenix-client@2.1.0

## 2.1.8

### Patch Changes

- 7f7aa06: add project tool

## 2.1.7

### Patch Changes

- Updated dependencies [da7800a]
  - @arizeai/phoenix-client@2.0.1

## 2.1.6

### Patch Changes

- Updated dependencies [118e881]
  - @arizeai/phoenix-client@2.0.0

## 2.1.5

### Patch Changes

- Updated dependencies [536258e]
  - @arizeai/phoenix-client@1.3.0

## 2.1.4

### Patch Changes

- Updated dependencies [f7fae3b]
- Updated dependencies [9273417]
- Updated dependencies [4dd23c8]
  - @arizeai/phoenix-client@1.2.0

## 2.1.3

### Patch Changes

- Updated dependencies [fff5511]
  - @arizeai/phoenix-client@1.1.0

## 2.1.2

### Patch Changes

- 4cbb0e6: chore: Update readme

## 2.1.1

### Patch Changes

- 37f766f: update the README for mcp

## 2.1.0

### Minor Changes

- a4f995d: make mcp file a binary
- 9f210de: change to a flat structure

## 2.0.0

### Major Changes

- 3acf533: feat(mcp): Initial release of @arizeai/phoenix-mcp
