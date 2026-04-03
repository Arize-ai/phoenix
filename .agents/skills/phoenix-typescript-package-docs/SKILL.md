---
name: phoenix-typescript-package-docs
description: >
  Maintain the bundled TypeScript package docs that ship inside Phoenix npm packages.
  Use this skill whenever adding or updating docs for `@arizeai/phoenix-client`,
  `@arizeai/phoenix-evals`, or `@arizeai/phoenix-otel`, when changing the Mintlify
  package-doc pages, when keeping `node_modules/.../docs` content aligned with actual
  exports, or when modifying the sync and publish flow for packaged docs.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  languages: TypeScript
  internal: true
---

# Phoenix TypeScript Package Docs

Keep the curated TypeScript package docs aligned with the real npm package surface area and with the publish-time sync flow.

## Quick Reference

| Task | What to inspect | What to update |
| ----- | ----- | ----- |
| Fix a stale example | `js/packages/<pkg>/src/` exports and function signatures | Canonical MDX under `docs/phoenix/sdk-api-reference/typescript/packages/<pkg>/` |
| Add or remove a page | Existing package-doc folder and `docs.json` nav | Canonical MDX, `docs.json`, and any landing-page links |
| Add a new package to the bundled-docs system | `js/scripts/sync-package-docs.mjs` and package `package.json` | Sync map, package `files`, package `prepack`, and Mintlify nav |
| Verify publish output | `node js/scripts/sync-package-docs.mjs` and `npm pack --dry-run` | Generated `js/packages/<pkg>/docs/` contents and tarball entries |

## Source Of Truth

The canonical authored docs live in Mintlify pages:

```text
docs/phoenix/sdk-api-reference/typescript/packages/phoenix-client/
docs/phoenix/sdk-api-reference/typescript/packages/phoenix-evals/
docs/phoenix/sdk-api-reference/typescript/packages/phoenix-otel/
```

The package examples remain in the package source trees:

```text
js/packages/phoenix-client/examples/
js/packages/phoenix-evals/examples/
js/packages/phoenix-otel/examples/
```

The published npm docs are staged copies:

```text
js/packages/phoenix-client/docs/
js/packages/phoenix-evals/docs/
js/packages/phoenix-otel/docs/
```

Do not hand-edit `js/packages/*/docs/`. Treat those folders as generated publish artifacts.
Ground doc content in the real package `src/` and `examples/` directories, but keep the published package docs focused on curated MDX pages.

## Current Packaging Flow

These files define the bundled-docs workflow:

- `js/scripts/sync-package-docs.mjs`
- `js/packages/phoenix-client/package.json`
- `js/packages/phoenix-evals/package.json`
- `js/packages/phoenix-otel/package.json`
- `docs.json`
- `docs/phoenix/sdk-api-reference/typescript/overview.mdx`
- `docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-client.mdx`
- `docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-evals.mdx`
- `docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-otel.mdx`

Each supported package must have:

- a canonical Mintlify package-doc folder
- a `docs` entry in `files`
- a `prepack` hook that runs the sync script for that package
- a `postpack` hook that removes staged package docs
- visible navigation in `docs.json`

## Authoring Rules

### 1. Read code before editing docs

Always ground docs in the actual exported surface:

- root exports: `js/packages/<pkg>/src/index.ts`
- submodule exports: `js/packages/<pkg>/src/<module>/index.ts`
- implementation and parameter shapes: matching files in `src/**`
- real usage patterns: `js/packages/<pkg>/examples/**`

Do not infer argument names or object shapes from older docs. Confirm them from code first.

### 2. Document exported entrypoints, not internals

Prefer pages and examples that match package entrypoints a developer imports:

- `@arizeai/phoenix-client`
- `@arizeai/phoenix-client/prompts`
- `@arizeai/phoenix-client/spans`
- `@arizeai/phoenix-client/sessions`
- `@arizeai/phoenix-client/experiments`
- `@arizeai/phoenix-evals`
- `@arizeai/phoenix-evals/llm`
- `@arizeai/phoenix-otel`

Do not center docs around private helpers or internal-only module paths.

### 3. Keep the packaged docs flat

Inside each package `docs/` folder, prefer a flat page layout such as:

```text
overview.mdx
experiments.mdx
```

Top-level authored MDX pages should stay flat.

### 4. Keep website docs and packaged docs aligned

If you add, remove, or rename a package-doc page:

1. update the canonical MDX file
2. update `docs.json`
3. update any package landing page links that point into the package-doc section
4. rerun the sync script

### 5. Prefer examples that prove real shapes

When a function takes a wrapped object such as `spanAnnotation`, `documentAnnotation`, `sessionAnnotation`, `spanNote`, `project`, or `dataset`, the example must use the real wrapper shape from code.

Common failure mode: docs drift toward simplified pseudo-APIs that do not match actual exported parameter names.

### 6. Hide agent-only implementation context

When a page benefits from implementation breadcrumbs like internal `src/**` paths or a full source map, do not render them as visible Markdown headings, bullet lists, or fenced code blocks in Mintlify.

Use hidden semantic HTML instead:

```mdx
<section
  className="hidden"
  data-agent-context="relevant-source-files"
  aria-label="Relevant source files"
>
  <h2>Relevant Source Files</h2>
  <ul>
    <li><code>src/example.ts</code> for the canonical implementation</li>
  </ul>
</section>

<section
  className="hidden"
  data-agent-context="source-map"
  aria-label="Source map"
>
  <h2>Source Map</h2>
  <ul>
    <li><code>src/index.ts</code></li>
    <li><code>src/helpers.ts</code></li>
  </ul>
</section>
```

Use semantic HTML elements like `<section>`, `<h2>`, `<ul>`, and `<li>` inside these hidden blocks rather than generic `<div>` wrappers, Markdown bullets, or fenced text blocks.
Reserve this pattern for brief agent-only implementation context. Keep user-facing docs focused on API behavior, workflows, and runnable examples.
Do not treat hidden blocks as access control. If content should be hidden from navigation as a whole, use a hidden page instead.

## Workflow

### Step 1: Determine the affected package and modules

Inspect the code change or user request and map it to one or more packages:

- `phoenix-client`
- `phoenix-evals`
- `phoenix-otel`

Then inspect the corresponding `src/` exports before writing docs.

### Step 2: Update canonical Mintlify docs

Edit only the canonical pages:

```text
docs/phoenix/sdk-api-reference/typescript/packages/<pkg>/*.mdx
```

If the change affects high-level discovery, also update:

- `docs/phoenix/sdk-api-reference/typescript/overview.mdx`
- `docs/phoenix/sdk-api-reference/typescript/arizeai-phoenix-<pkg>.mdx`

### Step 3: Sync generated package docs

Run:

```bash
node js/scripts/sync-package-docs.mjs
```

Or for one package:

```bash
node js/scripts/sync-package-docs.mjs phoenix-client
node js/scripts/sync-package-docs.mjs phoenix-evals
node js/scripts/sync-package-docs.mjs phoenix-otel
```

This stages:

- canonical MDX pages into `js/packages/<pkg>/docs/`

To remove staged docs manually:

```bash
node js/scripts/sync-package-docs.mjs clean phoenix-client
```

### Step 4: Verify the npm artifact

From each affected package:

```bash
cd js/packages/phoenix-client && npm pack --dry-run
cd js/packages/phoenix-evals && npm pack --dry-run
cd js/packages/phoenix-otel && npm pack --dry-run
```

Confirm the tarball includes:

- `docs/*.mdx`
- `src/**`

### Step 5: Check for nav and path regressions

If you changed page names or package coverage:

- confirm `docs.json` still parses
- confirm every referenced package-doc page exists
- confirm the package landing pages link to the correct section

## When Adding A New Bundled-Docs Package

If Phoenix starts shipping package docs for another TypeScript package, update all of:

1. `docs/phoenix/sdk-api-reference/typescript/packages/<new-package>/`
2. `docs.json`
3. `js/scripts/sync-package-docs.mjs`
4. `js/packages/<new-package>/package.json`

Required package manifest changes:

- include `docs` in `files`
- add a `prepack` hook that syncs the package docs

## Validation Checklist

- [ ] Examples match actual exported argument shapes
- [ ] Canonical docs were edited instead of generated package docs
- [ ] `node js/scripts/sync-package-docs.mjs` succeeds
- [ ] `npm pack --dry-run` includes `docs/*.mdx`
- [ ] `docs.json` paths still resolve

## Anti-Patterns

- Editing `js/packages/*/docs/` directly
- Updating examples without checking `src/**`
- Documenting internal helpers instead of importable entrypoints
- Adding a package-doc page without wiring it into `docs.json`
- Updating Mintlify docs but forgetting to verify the packed npm artifact
