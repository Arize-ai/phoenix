# Git API


## Contents

- POST `/git/add`
- GET `/git/branches`
- POST `/git/branches`
- DELETE `/git/branches`
- POST `/git/checkout`
- POST `/git/clone`
- POST `/git/commit`
- GET `/git/config`
- POST `/git/config`
- POST `/git/config/user`
- POST `/git/credentials`
- GET `/git/history`
- POST `/git/init`
- POST `/git/pull`
- POST `/git/push`
- GET `/git/remotes`
- POST `/git/remotes`
- POST `/git/reset`
- POST `/git/restore`
- GET `/git/status`

## POST `/git/add` {#daytona-toolbox/tag/git/POST/git/add}

**Add files to Git staging**

Add files to the Git staging area

### Request Body

Add files request

Schema: **GitAddRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | Yes | files to add (use . for all files) |
| `path` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/git/branches` {#daytona-toolbox/tag/git/GET/git/branches}

**List branches**

Get a list of all branches in the Git repository

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Repository path |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ListBranchResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/git/branches` {#daytona-toolbox/tag/git/POST/git/branches}

**Create a new branch**

Create a new branch in the Git repository

### Request Body

Create branch request

Schema: **GitBranchRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes |  |
| `path` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created |  |
| 400 | Bad Request | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## DELETE `/git/branches` {#daytona-toolbox/tag/git/DELETE/git/branches}

**Delete a branch**

Delete a branch from the Git repository

### Request Body

Delete branch request

Schema: **GitDeleteBranchRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes |  |
| `path` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 204 | No Content |  |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/git/checkout` {#daytona-toolbox/tag/git/POST/git/checkout}

**Checkout branch or commit**

Switch to a different branch or commit in the Git repository

### Request Body

Checkout request

Schema: **GitCheckoutRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | Yes |  |
| `path` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/git/clone` {#daytona-toolbox/tag/git/POST/git/clone}

**Clone a Git repository**

Clone a Git repository to the specified path. Defaults to strict TLS verification; set insecure_skip_tls=true to skip verification for self-signed or private-CA Git servers.

### Request Body

Clone repository request

Schema: **GitCloneRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No |  |
| `commit_id` | string | No |  |
| `depth` | integer | No | Depth creates a shallow clone truncated to the given number of commits. |
| `insecure_skip_tls` | boolean | No | Skip TLS certificate verification for this clone. Defaults to false (verify). Set to true ONLY for trusted internal Git servers with self-signed or private-CA certs; credentials, if supplied, will be transmitted over an unverified TLS connection and are exposed to any MITM on the route. |
| `password` | string | No |  |
| `path` | string | Yes |  |
| `url` | string | Yes |  |
| `username` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 401 | Unauthorized | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/git/commit` {#daytona-toolbox/tag/git/POST/git/commit}

**Commit changes**

Commit staged changes to the Git repository

### Request Body

Commit request

Schema: **GitCommitRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `allow_empty` | boolean | No |  |
| `author` | string | Yes |  |
| `email` | string | Yes |  |
| `message` | string | Yes |  |
| `path` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | GitCommitResponse |
| 400 | Bad Request | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/git/config` {#daytona-toolbox/tag/git/GET/git/config}

**Get a Git config value**

Get a Git config value at the given scope (null when unset)

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `key` | query | string | Yes | Config key (e.g. user.name) |
| `path` | query | string | No | Repository path (required for local scope) |
| `scope` | query | string | No | Config scope: global (default), local or system |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | GitConfigResponse |

---

## POST `/git/config` {#daytona-toolbox/tag/git/POST/git/config}

**Set a Git config value**

Set a Git config key/value at the given scope

### Request Body

Set config request

Schema: **GitSetConfigRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes |  |
| `path` | string | No | Path is the repository path, required when scope is "local". |
| `scope` | string | No | Scope is one of global (default), local or system. |
| `value` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |

---

## POST `/git/config/user` {#daytona-toolbox/tag/git/POST/git/config/user}

**Configure Git user**

Configure the Git user name and email at the given scope

### Request Body

Configure user request

Schema: **GitConfigureUserRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes |  |
| `name` | string | Yes |  |
| `path` | string | No | Path is the repository path, required when scope is "local". |
| `scope` | string | No | Scope is one of global (default), local or system. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |

---

## POST `/git/credentials` {#daytona-toolbox/tag/git/POST/git/credentials}

**Authenticate Git**

Persist Git credentials globally via the credential store. Stores the password in plaintext on disk.

### Request Body

Authenticate request

Schema: **GitAuthenticateRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `host` | string | No | Host defaults to github.com. |
| `password` | string | Yes |  |
| `protocol` | string | No | Protocol defaults to https. |
| `username` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |

---

## GET `/git/history` {#daytona-toolbox/tag/git/GET/git/history}

**Get commit history**

Get the commit history of the Git repository

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Repository path |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | array of GitCommitInfo |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/git/init` {#daytona-toolbox/tag/git/POST/git/init}

**Initialize a Git repository**

Initialize a new Git repository at the specified path

### Request Body

Init repository request

Schema: **GitInitRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bare` | boolean | No | Bare creates a repository without a working tree. |
| `initial_branch` | string | No | InitialBranch sets the name of the initial branch. |
| `path` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created |  |

---

## POST `/git/pull` {#daytona-toolbox/tag/git/POST/git/pull}

**Pull changes from remote**

Pull changes from the remote Git repository

### Request Body

Pull request

Schema: **GitPullRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch to pull (defaults to the current branch's upstream). |
| `password` | string | No |  |
| `path` | string | Yes |  |
| `remote` | string | No | Remote to pull from (defaults to "origin"). |
| `username` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 401 | Unauthorized | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## POST `/git/push` {#daytona-toolbox/tag/git/POST/git/push}

**Push changes to remote**

Push local changes to the remote Git repository

### Request Body

Push request

Schema: **GitPushRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branch` | string | No | Branch to push (defaults to the current branch). |
| `password` | string | No |  |
| `path` | string | Yes |  |
| `remote` | string | No | Remote to push to (defaults to "origin"). |
| `set_upstream` | boolean | No | SetUpstream records the pushed branch as the upstream tracking branch. |
| `username` | string | No |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |

---

## GET `/git/remotes` {#daytona-toolbox/tag/git/GET/git/remotes}

**List remotes**

List the remotes configured in the Git repository

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Repository path |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | ListRemotesResponse |

---

## POST `/git/remotes` {#daytona-toolbox/tag/git/POST/git/remotes}

**Add a remote**

Add (or overwrite) a remote in the Git repository

### Request Body

Add remote request

Schema: **GitAddRemoteRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fetch` | boolean | No | Fetch fetches from the remote immediately after adding it. |
| `name` | string | Yes |  |
| `overwrite` | boolean | No | Overwrite replaces an existing remote with the same name. |
| `path` | string | Yes |  |
| `url` | string | Yes |  |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 201 | Created |  |

---

## POST `/git/reset` {#daytona-toolbox/tag/git/POST/git/reset}

**Reset repository**

Reset the current HEAD to the specified state

### Request Body

Reset request

Schema: **GitResetRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | No | Files constrains the reset to the given paths. |
| `mode` | string | No | Mode is one of soft, mixed (default), hard, merge or keep. |
| `path` | string | Yes |  |
| `target` | string | No | Target is the revision to reset to (defaults to HEAD). |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |

---

## POST `/git/restore` {#daytona-toolbox/tag/git/POST/git/restore}

**Restore files**

Restore working tree files or unstage changes

### Request Body

Restore request

Schema: **GitRestoreRequest**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | array of string | Yes |  |
| `path` | string | Yes |  |
| `source` | string | No | Source restores file contents from the given revision instead of the index. |
| `staged` | boolean | No | Staged restores the staging index for the given files. |
| `worktree` | boolean | No | Worktree restores the working tree for the given files. |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK |  |
| 400 | Bad Request | ErrorResponse |
| 401 | Unauthorized | ErrorResponse |
| 403 | Forbidden | ErrorResponse |
| 409 | Conflict | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---

## GET `/git/status` {#daytona-toolbox/tag/git/GET/git/status}

**Get Git status**

Get the Git status of the repository at the specified path

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `path` | query | string | Yes | Repository path |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | GitStatus |
| 400 | Bad Request | ErrorResponse |
| 404 | Not Found | ErrorResponse |
| 500 | Internal Server Error | ErrorResponse |

---
