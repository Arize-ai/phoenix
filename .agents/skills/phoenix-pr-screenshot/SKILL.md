---
name: phoenix-pr-screenshot
description: Screenshot a running Phoenix feature and attach images to a GitHub PR. Builds the frontend, captures browser screenshots, uploads to GCS, and updates the PR body.
user-invocable: true
metadata:
  internal: true
---

# Phoenix PR Screenshot

Capture screenshots of the Phoenix UI to visually document a feature in a pull request. This skill handles the end-to-end workflow: launch, screenshot, upload, and attach to PR.

## Prerequisites

- Browser tooling capable of navigating the local Phoenix UI and saving screenshots
- `gsutil` authenticated with access to `gs://arize-phoenix-assets/`
- `gh` CLI authenticated with the Arize-ai/phoenix repo
- `pnpm` and `uv` available for building and running Phoenix

## Workflow

### Step 1: Start Phoenix

Use a development instance that matches the current checkout. `make dev-session`
works in any checkout, including the primary one, and gives the instance its own
database and ports so it never collides with `~/.phoenix/phoenix.db`:

```bash
# First start only: skip cloning the primary database unless the feature needs real data
PHOENIX_DEV_SEED_DATABASE=false make dev-session   # attached; run as a background task without a TTY

# In another shell (or after backgrounding): wait until api and frontend are both ready
make dev-sessions ARGS="status"
PHOENIX_URL="$(make --silent dev-sessions ARGS=url)"
```

Add any feature-specific environment variables to the worktree's `js/app/.env`
before starting. `status` prints the log directory when something fails. See the
`phoenix-worktree-dev` skill for restarts and handoff, and
[DEVELOPMENT.md](../../../DEVELOPMENT.md#optional-worktree-development-sessions)
for the full command reference. Do not start a second server when a suitable
instance already exists.

### Step 2: Build the frontend (only when not serving from Vite)

Development instances serve the UI from Vite, so no build is needed. Only if you
serve a production-style build (`phoenix serve` without `--dev`) does the backend
need `src/phoenix/server/static/` populated:

```bash
cd <repo-root>/js/app
pnpm run build
```

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

Stop only the development instance you started for this screenshot workflow:

```bash
make dev-sessions ARGS="stop"
```

Close the browser session created for the screenshots.

## Removing screenshots

To remove previously uploaded screenshots:

```bash
# Delete from GCS
gsutil rm gs://arize-phoenix-assets/pull-requests/<PR_NUMBER>-<name>.png

# Update PR body to remove the image references
gh pr edit <PR_NUMBER> --body "<updated body without screenshot section>"
```
