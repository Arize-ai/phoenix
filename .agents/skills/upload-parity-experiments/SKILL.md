---
name: upload-parity-experiments
description: Create or reuse Hugging Face dataset PRs for `harborframework/parity-experiments` and upload Harbor parity/oracle result folders efficiently with sparse checkout, raw git pushes, and Git LFS.
---

# Upload Parity Experiments

Use this skill to publish Harbor parity experiment outputs to the shared Hugging Face dataset and capture the resulting discussion URL for the adapter's `parity_pr` field.

## Why This Skill Exists

- `hf upload-large-folder` can be slow or unreliable for large parity bundles because it pushes through the Hub API commit loop.
- A normal git clone of `harborframework/parity-experiments` is too expensive because the dataset is very large.
- Hugging Face dataset PR refs are different from GitHub PR refs and are easy to misuse.
- Files larger than 10 MiB must be Git LFS-tracked before pushing.

This skill avoids the full clone by fetching only the target PR ref with `--depth 1 --filter=blob:none` and checking out only the paths needed for the current adapter.

## Prereqs

- Ensure Hugging Face authentication is available with discussion-write permission. Either a classic `write` token or a fine-grained token with global `discussion.write` enabled at <https://huggingface.co/settings/tokens>. A read-only or narrowly-scoped token will cause `create_pr.py` to fail with HTTP 403.
- Keep the target dataset fixed to `harborframework/parity-experiments` unless the user explicitly asks for another repo.
- Accept any local upload source that already contains the final files the user wants to publish.

## Preferred Workflow

1. Create or reuse a dataset PR.
2. Prepare a sparse local worktree for that PR ref.
3. Copy the local parity results into the sparse checkout.
4. Ensure every file larger than 10 MiB is Git LFS-tracked before committing.
5. Push directly to the PR ref with raw `git push`.
6. Share the discussion URL and record it as the adapter's `parity_pr`.

For large parity bundles, prefer raw git over `hf upload-large-folder`. The raw git path is materially faster and more reliable because it avoids the API-side commit loop and does not require cloning the entire parity dataset.

## 1. Create Or Reuse A Dataset PR

If the user already has a parity PR number, reuse it.

Otherwise, create one with the bundled helper:

```bash
uv run python scripts/create_pr.py create-pr \
  --title "Add parity experiments for <adapter_name>" \
  --description-file /path/to/pr-description.md
```

The script prints JSON including:

- `pr_number`
- `discussion_url`
- `repo_id`

## 2. Prepare A Sparse PR Checkout

```bash
mkdir -p /tmp/parity-experiments-pr<number>
cd /tmp/parity-experiments-pr<number>

git init
git remote add origin git@hf.co:datasets/harborframework/parity-experiments
git config core.sparseCheckout true
git sparse-checkout init --cone
git sparse-checkout set adapters/<adapter_name>

git fetch --depth 1 --filter=blob:none origin refs/pr/<number>:pr/<number>
git checkout pr/<number>
```

This fetches only the PR ref and the requested paths instead of cloning the full dataset repo.

## 3. Copy The Local Results

If the local folder already contains the final repo-root layout, copy it as-is.

If the local folder only contains the adapter subtree, copy it into `adapters/<adapter_name>/`:

```bash
rsync -a --delete \
  --exclude '.git' \
  --exclude '.cache' \
  --exclude '.DS_Store' \
  /path/to/local-folder/ \
  adapters/<adapter_name>/
```

## 4. Ensure Large Files Use Git LFS

The repo-root `.gitattributes` already LFS-tracks common binary, model, archive, and media extensions (`*.bin`, `*.parquet`, `*.safetensors`, images, audio, video, `*.log`, `*.txt`, etc.). Most parity outputs are covered automatically and need no manual action. Scan the sparse checkout for files larger than 10 MiB to catch anything that slipped through:

```bash
python - <<'PY'
from pathlib import Path

for path in sorted(Path(".").rglob("*")):
    if path.is_file() and ".git" not in path.parts and path.stat().st_size > 10 * 1024 * 1024:
        print(path)
PY
```

If any file is flagged and is not already covered by root, write the LFS rule to `adapters/<adapter_name>/.gitattributes` — never to the repo-root `.gitattributes`, which is a shared merge-conflict hotspot. Run `git lfs track` inside the adapter directory so the rule is written with a relative pattern:

```bash
(cd adapters/<adapter_name> && git lfs track "<pattern>")
git add adapters/<adapter_name>/.gitattributes
```

Git LFS honors nested `.gitattributes` files, so rules added this way apply only to that adapter and never collide with other in-flight parity PRs.

## 5. Commit And Push

```bash
find . -name .DS_Store -delete
git add adapters/<adapter_name>
git commit -m "Add parity experiment artifacts for <adapter_name>"
GIT_SSH_COMMAND='ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=10' \
  git push origin pr/<number>:refs/pr/<number>
```

## 6. Record The Discussion URL

Use this discussion URL in `parity_experiment.json`:

```text
https://huggingface.co/datasets/harborframework/parity-experiments/discussions/<number>
```

## Monitoring And Retry

When raw `git push` is running, check the live output first. Large pushes often spend a long time in:

- `git-lfs pre-push`
- single-object LFS uploads
- packfile compression

Useful checks:

```bash
git ls-remote git@hf.co:datasets/harborframework/parity-experiments refs/pr/<number>
```

```bash
ps -p <pid> -o pid=,etime=,command=
```

If the push exits early:

- rerun the exact same `git push` command first
- if Hugging Face rejects a file larger than 10 MiB, add the needed `git lfs track` rules, re-add the file, and retry
- if the connection broke mid-push, rerun the same push command before changing anything else

## Fallback

Use `hf upload-large-folder` only as a fallback when raw git is unavailable or the user explicitly asks for it.

You can still create the PR with the bundled helper and upload to the PR revision:

```bash
hf upload-large-folder harborframework/parity-experiments \
  <local-folder> \
  --repo-type dataset \
  --revision refs/pr/<pr-number> \
  --exclude ".DS_Store" \
  --exclude "**/.DS_Store" \
  --num-workers 8
```

## Guardrails

- Do not upload the Harbor repo itself by accident. Upload only the intended local results folder.
- Do not fall back to a full clone of `harborframework/parity-experiments`.
- Do not modify the repo-root `.gitattributes`. Put any adapter-specific LFS rules in `adapters/<adapter_name>/.gitattributes` instead.
- Always remove or exclude `.DS_Store`.
- Before pushing, make sure every file larger than 10 MiB is LFS-tracked.
- If the user already has a parity PR number, reuse it instead of creating another one.
