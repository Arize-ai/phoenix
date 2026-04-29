---
name: phoenix-release-please
description: >
  Bump the next release-please version for a Phoenix Python package (arize-phoenix,
  arize-phoenix-client, arize-phoenix-evals, arize-phoenix-otel) by opening a PR with a
  Release-As commit footer. Use this skill when the user asks to "set the release-please
  version", "force a 2.0.0 release", "release X as Y", "skip a version", or otherwise wants
  release-please to propose a specific version on its next run instead of the version it would
  pick from conventional commits.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  internal: true
---

# Phoenix release-please version bump

Force release-please to propose a specific next version for a managed package by landing a
commit with a [`Release-As`][release-as] trailer.

[release-as]: https://github.com/googleapis/release-please#how-do-i-change-the-version-number

## Packages

Declared in `release-please-config.json`; current versions in `.release-please-manifest.json`.

| Path | Package |
|---|---|
| `.` | `arize-phoenix` (root has `exclude-paths`; touch a file *outside* them, e.g. `src/phoenix/`) |
| `packages/phoenix-client` | `arize-phoenix-client` |
| `packages/phoenix-evals` | `arize-phoenix-evals` |
| `packages/phoenix-otel` | `arize-phoenix-otel` |

## Procedure

1. **Verify the bump.** `jq . .release-please-manifest.json` — target must be strictly greater
   than the current entry.
2. **Branch off `main`.**
3. **Make a small real edit inside the package path** (typo fix, comment cleanup). Without a
   file change in that path, release-please ignores the commit. Don't edit `pyproject.toml`'s
   `version` or `.release-please-manifest.json` — release-please owns those.
4. **Commit with the trailer in the body:**

   ```bash
   git commit -m "$(cat <<'EOF'
   chore: release <package> <version>

   <one-line rationale>

   Release-As: <version>
   EOF
   )"
   ```

5. **Open the PR** with `chore:` title and the trailer also at the end of the PR body
   (defensive, in case squash settings change).
6. **After merge, verify the trailer survived:**

   ```bash
   git fetch origin main && git log -1 origin/main --format='%B' | grep '^Release-As:'
   ```

   Then confirm release-please opened/updated
   `release-please--branches--main--components--<package>` proposing the requested version.

## Squash-merge gotcha

Repo settings (verify with
`gh api repos/Arize-ai/phoenix --jq '{squash_merge_commit_title, squash_merge_commit_message}'`):
`COMMIT_OR_PR_TITLE` + `COMMIT_MESSAGES`. The squash body comes from **commit messages**, not
the PR description — so `Release-As` must live in a real commit's body. A trailer that exists
only in the PR description is dropped on squash and release-please never sees it.

## Common pitfalls

| Mistake | Fix |
|---|---|
| Empty commit / PR body only | Trailer needs a real file change *and* must be in a commit body. |
| `Release-As: v2.6.0` | Use the bare version (`Release-As: 2.6.0`). |
| Touched only `pyproject.toml` `version` | Revert; let release-please rewrite that file itself. |
| Bumping `arize-phoenix` via a `docs/` or `tests/` edit | That path is in `exclude-paths`; pick a file under `src/phoenix/` instead. |
| Multiple `Release-As` trailers across commits | Use one trailer on one commit. |
