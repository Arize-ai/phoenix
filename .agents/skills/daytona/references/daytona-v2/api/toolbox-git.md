# Toolbox API: git

Git repository operations inside the sandbox.

## Contents

- [Stage files](#stage-files)
- [List branches](#list-branches)
- [Create a branch](#create-a-branch)
- [Delete a branch](#delete-a-branch)
- [Switch branches](#switch-branches)
- [Clone a repository](#clone-a-repository)
- [Create a commit](#create-a-commit)
- [Read one git config key](#read-one-git-config-key)
- [Set one git config key](#set-one-git-config-key)
- [Read commit history](#read-commit-history)
- [Initialize a repository](#initialize-a-repository)
- [Pull from a remote](#pull-from-a-remote)
- [Push a branch](#push-a-branch)
- [List remotes](#list-remotes)
- [Add a remote](#add-a-remote)
- [Reset repository state](#reset-repository-state)
- [Restore files](#restore-files)
- [Read repository status](#read-repository-status)

## Stage files

`POST /git/add`

Run `git add -- <files...>` in the target repository.

### Request Body

`application/json`: [AddRequest](./toolbox-schemas.md#addrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | File paths to stage, relative to the repository root. |
| `path` | string | No | Repository path to run `git add` in. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Files staged |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`, no files, or invalid pathspec | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git add did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `AddRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## List branches

`GET /git/branches`

Return local branch names from the target repository.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Repository path to inspect. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [BranchList](./toolbox-schemas.md#branchlist) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` is missing | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git branch did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Create a branch

`POST /git/branches`

Create one branch in the target repository.

### Request Body

`application/json`: [BranchRequest](./toolbox-schemas.md#branchrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `force` | boolean | No | Force deletion of an unmerged branch using `git branch -D`. Defaults to false: deletion uses `git branch -d`, refusing an unmerged branch with 409 `CONFLICT`. Ignored when creating a branch. |
| `name` | string | No | Branch name to create or delete. A leading `+` is a literal part of the name, not a refspec force marker. |
| `path` | string | No | Repository path to operate in. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Branch created |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`, or missing branch name | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git branch did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `GIT_BRANCH_EXISTS` — the branch already exists; `CONFLICT` — a concurrent ref update prevents creation | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `BranchRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Delete a branch

`DELETE /git/branches`

Delete one branch using git branch -d by default: an unmerged branch is refused with 409 CONFLICT. Set force=true to use git branch -D and permit deletion of an unmerged branch. A checked-out branch is refused even with force=true.

### Request Body

`application/json`: [BranchRequest](./toolbox-schemas.md#branchrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `force` | boolean | No | Force deletion of an unmerged branch using `git branch -D`. Defaults to false: deletion uses `git branch -d`, refusing an unmerged branch with 409 `CONFLICT`. Ignored when creating a branch. |
| `name` | string | No | Branch name to create or delete. A leading `+` is a literal part of the name, not a refspec force marker. |
| `path` | string | No | Repository path to operate in. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | Branch deleted |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`, or missing branch name | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND`, `GIT_BRANCH_NOT_FOUND` — the repository or branch was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git branch did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — the branch is unmerged, checked out, or concurrently updated | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `BranchRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Switch branches

`POST /git/checkout`

Switch the target repository to another branch using `git switch`.

### Request Body

`application/json`: [CheckoutRequest](./toolbox-schemas.md#checkoutrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch name to switch to. |
| `path` | string | No | Repository path to operate in. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Branch checked out |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`, or missing branch name | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND`, `GIT_BRANCH_NOT_FOUND` — the repository or requested branch was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git switch did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — switching would overwrite local changes or the branch is checked out elsewhere | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `CheckoutRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Clone a repository

`POST /git/clone`

Clone a repository URL or local path into a destination directory. Credentials are never returned. Optional `depth` (1–2147483647) performs a shallow clone; `insecureSkipTls=true` disables TLS verification for this request only. A non-empty destination is rejected with BAD_REQUEST.

### Request Body

`application/json`: [CloneRequest](./toolbox-schemas.md#clonerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string \| null | No | Branch to clone when `commit_id` is omitted. A leading `+` is literal. |
| `commit_id` | string \| null | No | Commit to detach to after cloning. |
| `depth` | integer (int32) \| null | No | Optional shallow-clone depth, from 1 through 2147483647. `1` clones only the tip commit. Values representable as u32 but outside this range return 400 `BAD_REQUEST`; invalid JSON types or values outside u32 return 422 `UNPROCESSABLE_ENTITY`. |
| `insecureSkipTls` | boolean \| null | No | Skip TLS certificate verification for this clone invocation only. |
| `password` | string \| null | No | Password for authenticated remotes; write-only and never returned. |
| `path` | string | No | Destination path to clone into. |
| `url` | string | No | Repository URL or local source path to clone. |
| `username` | string \| null | No | Username for authenticated remotes; write-only and never returned. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Repository cloned |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `url`/`path`, depth outside 1–2147483647, non-empty destination, or invalid commit_id | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 401 | `GIT_AUTH_FAILED` — remote authentication failed or credentials are required | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND`, `GIT_BRANCH_NOT_FOUND` — the source repository or requested branch was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — the clone did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `CloneRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Create a commit

`POST /git/commit`

Create one commit and return its full SHA from the commit operation itself, not a later read of HEAD. Concurrent commits in linked worktrees or checkouts cannot substitute a different commit's SHA. Author identity is passed to git for this invocation only and is not written into repository config. Nothing to commit without allow_empty returns 400 BAD_REQUEST.

### Request Body

`application/json`: [CommitRequest](./toolbox-schemas.md#commitrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allow_empty` | boolean | No | Whether an empty commit is allowed. |
| `author` | string | No | Commit author name passed to git for this invocation only. |
| `email` | string | No | Commit author email passed to git for this invocation only. |
| `message` | string | No | Commit message. |
| `path` | string | No | Repository path to commit in. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [CommitResponse](./toolbox-schemas.md#commitresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — malformed JSON, missing commit metadata, or nothing to commit without allow_empty | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git commit did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — unmerged files or a concurrent index/ref update | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `CommitRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Read one git config key

`GET /git/config`

Read one git config value from global scope by default, or local scope when `scope=local` and `path` is provided.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `key` | query | string | No | Config key to read. |
| `path` | query | string | No | Repository path required for `scope=local`. |
| `scope` | query | string | No | Config scope; omitted means `global`. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [GitConfigResponse](./toolbox-schemas.md#gitconfigresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — missing key, invalid scope, invalid key, or missing local path | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the local-scope repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git config did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Set one git config key

`POST /git/config`

Write one git config value to global scope by default, or local scope when `scope=local` and `path` is provided.

### Request Body

`application/json`: [SetConfigRequest](./toolbox-schemas.md#setconfigrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | No | Config key to set. |
| `path` | string \| null | No | Repository path required for `scope=local`. |
| `scope` | string \| null | No | Config scope; omitted means `global`. |
| `value` | string | No | Config value to write. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Config value set |  |
| 400 | `BAD_REQUEST` — malformed JSON, invalid scope, invalid key, or missing local path | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the local-scope repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git config did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `SetConfigRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Read commit history

`GET /git/history`

Return commit metadata from `git log` in newest-first order. A repository with no commits returns 400 BAD_REQUEST.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Repository path to inspect. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | array of [CommitInfo](./toolbox-schemas.md#commitinfo) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` is missing or the repository has no commits | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git log did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Initialize a repository

`POST /git/init`

Initialize a Git repository and return its creation status.

### Request Body

`application/json`: [InitRequest](./toolbox-schemas.md#initrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bare` | boolean | No | Whether to create a bare repository. |
| `initial_branch` | string \| null | No | Initial branch name for a new non-bare repository. |
| `path` | string | No | Destination path for the new repository. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Repository initialized |  |
| 400 | `BAD_REQUEST` — malformed JSON or missing `path` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git init did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `InitRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Pull from a remote

`POST /git/pull`

Pull from the repository's configured upstream by default, or from an explicit `remote` and optional `branch`, with `--ff-only` so divergent history becomes a conflict instead of a merge.

### Request Body

`application/json`: [RepoRequest](./toolbox-schemas.md#reporequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string \| null | No | Remote branch to push or pull. Omitted keeps the current HEAD push behaviour and git's default pull target. A leading `+` is a literal part of the branch name, never a force flag. |
| `password` | string \| null | No | Password for authenticated remotes; write-only and never returned. |
| `path` | string | No | Repository path to operate in. |
| `remote` | string \| null | No | Remote name. Omitted defaults to `origin` for push and for pull when `branch` is set; a pull without `branch` uses git's configured upstream. |
| `setUpstream` | boolean \| null | No | Pass `-u` / `--set-upstream` on push. |
| `username` | string \| null | No | Username for authenticated remotes; write-only and never returned. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Pull completed |  |
| 400 | `BAD_REQUEST` — malformed JSON or missing `path` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 401 | `GIT_AUTH_FAILED` — remote authentication failed or credentials are required | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git pull did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — non-fast-forward update or conflicting working-tree/index state | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `RepoRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Push a branch

`POST /git/push`

Push the current HEAD ref by default, or an explicit `branch` to `remote` (default `origin`) using an explicit `<ref>:<ref>` refspec. `setUpstream=true` passes `-u` to git.

### Request Body

`application/json`: [RepoRequest](./toolbox-schemas.md#reporequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string \| null | No | Remote branch to push or pull. Omitted keeps the current HEAD push behaviour and git's default pull target. A leading `+` is a literal part of the branch name, never a force flag. |
| `password` | string \| null | No | Password for authenticated remotes; write-only and never returned. |
| `path` | string | No | Repository path to operate in. |
| `remote` | string \| null | No | Remote name. Omitted defaults to `origin` for push and for pull when `branch` is set; a pull without `branch` uses git's configured upstream. |
| `setUpstream` | boolean \| null | No | Pass `-u` / `--set-upstream` on push. |
| `username` | string \| null | No | Username for authenticated remotes; write-only and never returned. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Push completed |  |
| 400 | `BAD_REQUEST` — malformed JSON or missing `path` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 401 | `GIT_AUTH_FAILED` — remote authentication failed or credentials are required | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND`, `NOT_FOUND` — the repository or HEAD ref could not be resolved | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git push did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 409 | `CONFLICT` — non-fast-forward update | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `RepoRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## List remotes

`GET /git/remotes`

Return configured remotes. Any userinfo in remote URLs is redacted before it is returned.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Repository path to inspect. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [ListRemotesResponse](./toolbox-schemas.md#listremotesresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` is missing | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git remote did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure or malformed git output | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Add a remote

`POST /git/remotes`

Run `git remote add` in the target repository.

### Request Body

`application/json`: [AddRemoteRequest](./toolbox-schemas.md#addremoterequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Remote name to create. |
| `path` | string | No | Repository path to operate in. |
| `url` | string | No | Remote URL to store. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Remote added |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`/`name`/`url`, or duplicate remote name | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git remote add did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `AddRemoteRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Reset repository state

`POST /git/reset`

Run `git reset` with the requested mode, target, and optional pathspecs.

### Request Body

`application/json`: [ResetRequest](./toolbox-schemas.md#resetrequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | Optional pathspecs to reset in mixed mode. |
| `mode` | string \| null | No | Reset mode (`mixed`, `soft`, `hard`, `merge`, `keep`); omitted means git's default mixed reset. |
| `path` | string | No | Repository path to operate in. |
| `target` | string \| null | No | Commit-ish to reset to. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Reset completed |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`, invalid reset mode, or invalid pathspec usage | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git reset did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `ResetRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Restore files

`POST /git/restore`

Run `git restore` for one or more files from the index, worktree, or an optional source tree-ish.

### Request Body

`application/json`: [RestoreRequest](./toolbox-schemas.md#restorerequest)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | File paths to restore. |
| `path` | string | No | Repository path to operate in. |
| `source` | string \| null | No | Optional source tree-ish for the restore. |
| `staged` | boolean \| null | No | Whether to restore the index entry. |
| `worktree` | boolean \| null | No | Whether to restore the worktree entry. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Restore completed |  |
| 400 | `BAD_REQUEST` — malformed JSON, missing `path`, no files, or an invalid staged/worktree combination | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git restore did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 422 | `UNPROCESSABLE_ENTITY` — the JSON body does not match `RestoreRequest` | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---

## Read repository status

`GET /git/status`

Return the current branch, ahead/behind counts, and file status entries from `git status --porcelain=v2 --branch -z`.

### Parameters

| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `path` | query | string | No | Repository path to inspect. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  | [StatusResponse](./toolbox-schemas.md#statusresponse) (`application/json`) |
| 400 | `BAD_REQUEST` — `path` is missing or the repository has no working tree | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 404 | `GIT_REPO_NOT_FOUND` — the repository was not found | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 408 | `REQUEST_TIMEOUT` — git status did not finish before the API deadline | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |
| 500 | Internal git failure or malformed git output | [ErrorEnvelope](./toolbox-schemas.md#errorenvelope) (`application/json`) |

---
