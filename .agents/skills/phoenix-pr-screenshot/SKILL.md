---
name: phoenix-pr-screenshot
description: Screenshot a running Phoenix feature and attach images to a GitHub PR. Builds the frontend, captures browser screenshots, uploads to GCS, and updates the PR body.
user-invocable: true
metadata:
  internal: true
---

# Phoenix PR Screenshot

Capture screenshots of the Phoenix UI to visually document a feature in a pull request. This skill handles the end-to-end workflow: build, launch, screenshot, upload, and attach to PR.

## Prerequisites

- Browser tooling capable of navigating the local Phoenix UI and saving screenshots
- `gsutil` authenticated with access to `gs://arize-phoenix-assets/`
- `gh` CLI authenticated with the Arize-ai/phoenix repo
- `pnpm` and `uv` available for building and running Phoenix

## Workflow

### Step 1: Build the frontend

The Phoenix backend serves the built frontend from `src/phoenix/server/static/`. Build it from the `js/app/` directory:

```bash
cd <repo-root>/js/app
pnpm install   # only if node_modules is missing
pnpm run build
```

This compiles the React app and copies static assets into the Python server's static directory. Without this step, page routes like `/playground` return 404.

### Step 2: Start Phoenix

Use a Phoenix development instance that matches the current checkout. If none is
running, start one with the repository's development commands and any
feature-specific environment variables. In a git worktree, follow the
`phoenix-worktree-dev` skill for optional isolated session management.

Prefer fresh data for screenshots unless the feature needs an existing dataset.
Record the instance base URL as `PHOENIX_URL`, wait until it is ready, and do not
start a second server when a suitable one already exists.

### Step 3: Capture screenshots

Use the available browser tooling to open `${PHOENIX_URL}/playground` (or the relevant feature page), interact with the UI to show the feature, and save screenshots locally.

- Wait for the target UI elements to be visible and ready before interacting or capturing screenshots.
- Inspect the page again after navigation or DOM changes before choosing the next element to interact with.
- Take multiple screenshots when useful (before/after, dropdown open, etc.).
- View the saved screenshots to verify they captured what you intended, and use their local paths in the upload step.

### Step 4: Upload to GCS

Upload screenshots to the shared PR assets bucket, prefixed with the PR number for organization:

```bash
gsutil cp /path/to/screenshot.png gs://arize-phoenix-assets/pull-requests/<PR_NUMBER>-<descriptive-name>.png
```

Naming convention: `<PR_NUMBER>-<descriptive-name>.png` (e.g., `11986-playground-loaded.png`, `11986-provider-dropdown.png`)

### Step 5: Update the PR body

Add the GCS-hosted images to the PR description using `gh pr edit`:

```bash
gh pr edit <PR_NUMBER> --body "$(cat <<'EOF'
## Summary
<existing summary>

## Screenshots
<description of what's shown>

![descriptive-alt-text](https://storage.googleapis.com/arize-phoenix-assets/pull-requests/<PR_NUMBER>-<name>.png)

## Test plan
<existing test plan>
EOF
)"
```

Always preserve the existing PR body content — read it first with `gh pr view <PR_NUMBER> --json body -q .body`, then add the Screenshots section.

### Step 6: Cleanup

Stop only the development instance started for this screenshot workflow, using
the matching development command (`Ctrl+C` or `make dev-sessions ARGS="stop"` for a
managed session).

Close the browser session created for the screenshots.

## Removing screenshots

To remove previously uploaded screenshots:

```bash
# Delete from GCS
gsutil rm gs://arize-phoenix-assets/pull-requests/<PR_NUMBER>-<name>.png

# Update PR body to remove the image references
gh pr edit <PR_NUMBER> --body "<updated body without screenshot section>"
```
