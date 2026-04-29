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

Force release-please to propose a specific next version for one of the Python packages it
manages in this repo by landing a commit with a [`Release-As` trailer][release-as].

[release-as]: https://github.com/googleapis/release-please#how-do-i-change-the-version-number

## When to use

The user wants release-please's next release PR for a package to target an explicit version —
typically to bump the minor or major beyond what conventional commits would yield, or to skip a
patch number. Common phrasings:

- "set the release-please version of arize-phoenix-client to 2.6.0"
- "release arize-phoenix-evals as 4.0.0"
- "force a major bump on arize-phoenix-otel"

If the user just wants a normal release, do **not** use this skill — release-please will open a
release PR on its own once `feat:` / `fix:` commits land on `main`.

## Repo layout

`release-please-config.json` at the repo root declares four packages:

| Path | Package name | Manifest entry |
|---|---|---|
| `.` | `arize-phoenix` (server) | `"."` |
| `packages/phoenix-client` | `arize-phoenix-client` | `"packages/phoenix-client"` |
| `packages/phoenix-evals` | `arize-phoenix-evals` | `"packages/phoenix-evals"` |
| `packages/phoenix-otel` | `arize-phoenix-otel` | `"packages/phoenix-otel"` |

Current versions live in `.release-please-manifest.json`.

The root (`.`) package has many `exclude-paths` (`.github`, `docs`, `js`, `packages`, `tests`,
…). A change inside any excluded path is **not** counted as a server change. To bump
`arize-phoenix` itself, the path-touching change has to live somewhere not in that exclude
list — e.g. `src/phoenix/` or `pyproject.toml`.

## How release-please picks up `Release-As`

Release-please scans commits on `main`. For each managed package, it looks at commits whose
diff touches a file inside the package's path (and not inside its `exclude-paths`). Among those
commits, a `Release-As: X.Y.Z` git trailer in the commit body forces the next release PR for
that package to target `X.Y.Z`, regardless of what conventional-commit types are present.

Two conditions must both hold:

1. The commit must touch at least one file inside the package's path. A commit with only a
   `Release-As` trailer and no file change in the package path is invisible to release-please.
2. The trailer must end up in the **commit message on `main`** after merge. Squash merging
   strips per-commit messages and uses the squash commit message instead — see "Squash merge
   gotcha" below.

## Procedure

### 1. Confirm the target version is a valid bump

```bash
jq . .release-please-manifest.json
```

Check that the requested version is strictly greater than the current entry. Release-please
will reject a `Release-As` that is lower than the last released version.

### 2. Create a branch off `main`

```bash
git checkout main
git pull
git checkout -b <user>/release-please-<package>-<version>
```

### 3. Make a minimal change inside the package path

Pick a small, real edit so release-please sees a change scoped to the package. Good options,
in priority order:

1. A genuine docs/typo fix in the package's `README.md` or a docstring.
2. A non-functional comment clarification.
3. A no-op whitespace change (last resort — reviewers may push back).

Do **not** edit `pyproject.toml` `version` or `.release-please-manifest.json` directly:
release-please owns those files and will rewrite them in its own release PR.

For the root `arize-phoenix` package, make sure the file is **not** under any of the
`exclude-paths` listed in `release-please-config.json`.

### 4. Commit with a `Release-As` trailer

The trailer must be a separate paragraph at the end of the commit body, with no blank line
inside the trailer block:

```bash
git commit -m "$(cat <<'EOF'
chore: release <package-name> <version>

<short rationale — why we are skipping ahead, e.g. "promote breaking dataset upsert
change to a major bump">.

Release-As: <version>
EOF
)"
```

Use `chore:` (or `chore(<scope>):`) — this is a release-management commit, not a feature.

### 5. Push and open a PR against `main`

```bash
git push -u origin <branch>
gh pr create \
  --base main \
  --title "chore: release <package-name> <version>" \
  --body "$(cat <<'EOF'
## Summary

Instructs release-please to release the next `<package-name>` as `<version>` via a
[`Release-As`](https://github.com/googleapis/release-please#how-do-i-change-the-version-number)
trailer on the squash commit.

The in-package change in this PR (a small README/comment edit) exists only so release-please
sees a commit scoped to `<package-path>/`.

## Test plan

- [ ] After merge, confirm release-please opens or updates
      `release-please--branches--main--components--<package-name>` proposing `<version>`.

Release-As: <version>
EOF
)"
```

Putting `Release-As: <version>` at the end of the PR body is belt-and-suspenders so the trailer
is visible regardless of how the squash message is composed.

### 6. Verify after merge

After the PR squash-merges:

```bash
# Trailer survived into the merge commit on main
git fetch origin main
git log -1 origin/main --format='%B' | grep '^Release-As:'

# Release-please workflow ran (manually trigger if needed)
gh workflow list --repo Arize-ai/phoenix | grep -i release-please
gh run list --repo Arize-ai/phoenix --workflow=release-please.yml --limit 5

# Resulting release PR proposes the requested version
gh pr list --repo Arize-ai/phoenix \
  --head "release-please--branches--main--components--<package-name>" \
  --state open
```

If the trailer isn't on the merge commit, see "Squash merge gotcha" — re-run as a fresh PR
with the trailer placed correctly.

## Squash merge gotcha

The repo's squash settings (check with
`gh api repos/Arize-ai/phoenix --jq '{squash_merge_commit_title, squash_merge_commit_message}'`)
are currently:

- `squash_merge_commit_title: COMMIT_OR_PR_TITLE` — with **one** commit on the PR, GitHub uses
  the **commit subject**; with multiple commits, it uses the **PR title**.
- `squash_merge_commit_message: COMMIT_MESSAGES` — squash body is the concatenation of the
  branch's commit messages.

Implications:

| Scenario | What ends up on `main` |
|---|---|
| One commit, trailer in commit body | Title = commit subject. Body = commit body, **including** `Release-As`. ✅ |
| Multiple commits, trailer in last commit body | Title = PR title. Body = all commit messages concatenated, including `Release-As`. ✅ |
| Trailer only in PR body, not in any commit | `COMMIT_MESSAGES` ignores the PR body. Trailer is **lost**. ❌ |

The safe pattern is: **put `Release-As` in a real commit's body**, not just the PR description.

If you discover after-the-fact that the merge commit on `main` is missing the trailer, you have
two options:

1. Open a new tiny PR with another in-package commit carrying the `Release-As` trailer.
2. Push an empty commit on `main` directly (only if you have permission and the workflow allows
   it): `git commit --allow-empty -m "chore: release <pkg> <ver>" -m "Release-As: <ver>"`.

## Decision quick reference

| Question | Answer |
|---|---|
| Bumping `arize-phoenix` (server) — where do I edit? | Anywhere outside `exclude-paths` in `release-please-config.json` (e.g. `src/phoenix/`). |
| Can I just push an empty commit to my branch? | No — release-please needs a file change inside the package path. |
| Should I edit `pyproject.toml`'s `version`? | No — release-please rewrites it in its own release PR. |
| Should I edit `.release-please-manifest.json`? | No — same reason. |
| Multiple `Release-As` trailers across commits? | Don't. Use one trailer on one commit. |
| Trailer with `v` prefix (`Release-As: v2.6.0`)? | No — use the bare version (`Release-As: 2.6.0`). |

## Pre-submit checklist

- [ ] Target version is strictly greater than the current entry in
      `.release-please-manifest.json`.
- [ ] Branch contains at least one file change inside the target package's path (and outside
      its `exclude-paths`, for the root server package).
- [ ] Exactly one commit carries `Release-As: <version>` as a trailer in its body.
- [ ] PR title uses `chore:` (or `chore(<scope>):`) and names the package + version.
- [ ] PR body also ends with the `Release-As: <version>` trailer (defensive, in case squash
      settings change).
- [ ] No edits to `pyproject.toml` `version` field or `.release-please-manifest.json`.
