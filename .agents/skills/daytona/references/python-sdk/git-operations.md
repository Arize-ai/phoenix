## Contents

- Basic operations
- Branch operations
- Stage changes
- Commit changes
- Remote operations
- Advanced operations




Git operations are available through the `git` module of a sandbox. Operations run through the Daytona API, so your application works with repositories in a sandbox directly, without installing Git clients or executing shell commands inside it.

The `git` module covers cloning repositories, checking status, managing branches, staging and committing changes, pushing and pulling with authentication, and inspecting commit history. Private repositories authenticate with personal access tokens passed per operation.

## Basic operations

Daytona provides methods to clone, check status, and manage Git repositories in sandboxes.

Git operations assume you are operating in the sandbox user's home directory (e.g. `workspace` implies `/home/[username]/workspace`). Use a leading `/` when providing absolute paths.

### Clone repositories

Clone a Git repository into a sandbox by providing the URL and path to clone it to. You can clone public or private repositories, specific branches or commits, and authenticate using personal access tokens.

```python
# Basic clone
sandbox.git.clone(
    url="https://github.com/user/repo.git",
    path="workspace/repo"
)

# Clone with authentication
sandbox.git.clone(
    url="https://github.com/user/repo.git",
    path="workspace/repo",
    username="git",
    password="personal_access_token"
)

# Clone specific branch
sandbox.git.clone(
    url="https://github.com/user/repo.git",
    path="workspace/repo",
    branch="develop"
)

# Clone a specific commit (detached HEAD)
sandbox.git.clone(
    url="https://github.com/user/repo.git",
    path="workspace/repo-old",
    commit_id="abc123def456"
)

# Clone from a self-signed internal Git server (insecure)
sandbox.git.clone(
    url="https://internal-git.example.com/org/repo.git",
    path="workspace/repo",
    insecure_skip_tls=True
)
```

### Get repository status

Get the status of a Git repository by providing the path to the repository.

You can get the current branch, modified files, and the number of commits ahead and behind the upstream tracking branch. When no upstream is configured, `ahead` and `behind` are zero and `branch_published` is false. The response also includes `upstream` (for example `origin/main`) and `detached` when HEAD is not on a branch.

```python
# Get repository status
status = sandbox.git.status("workspace/repo")
print(f"Current branch: {status.current_branch}")
print(f"Upstream: {status.upstream}")
print(f"Detached HEAD: {status.detached}")
print(f"Commits ahead: {status.ahead}")
print(f"Commits behind: {status.behind}")
for file in status.file_status:
    print(f"File: {file.name}")

# List branches
response = sandbox.git.branches("workspace/repo")
print(f"Checked out branch: {response.current}")
for branch in response.branches:
    print(f"Branch: {branch}")
```

## Branch operations

Daytona provides methods to manage branches in Git repositories. You can create, switch, and delete branches. Checkout accepts a branch name or a commit SHA.

### Create branches

Create a new branch by providing the path to the repository and the name of the new branch.

```python
# Create a new branch
sandbox.git.create_branch("workspace/repo", "new-feature")
```

### Checkout branches or commits

Checkout a branch or commit by providing the path to the repository and the name of the branch or commit SHA. Pass a commit SHA to enter detached HEAD state.

```python
# Checkout a branch
sandbox.git.checkout_branch("workspace/repo", "feature-branch")

# Checkout a commit (detached HEAD)
sandbox.git.checkout_branch("workspace/repo", "abc123def456")
```

### Delete branches

Delete a branch by providing the path to the repository and the name of the branch.

```python
# Delete a branch
sandbox.git.delete_branch("workspace/repo", "old-feature")
```

## Stage changes

Stage specific files, all changes, or the whole repository by providing the path to the repository and the files to stage.

```python
# Stage a single file
sandbox.git.add("workspace/repo", ["file.txt"])

# Stage multiple files
sandbox.git.add("workspace/repo", [
    "src/main.py",
    "tests/test_main.py",
    "README.md"
])
```

## Commit changes

Commit changes by providing the path to the repository, the message, author, and email.

```python
# Stage and commit changes
sandbox.git.add("workspace/repo", ["README.md"])
sandbox.git.commit(
    path="workspace/repo",
    message="Update documentation",
    author="John Doe",
    email="john@example.com",
    allow_empty=True
)
```

## Remote operations

Daytona provides methods to work with remote repositories in Git. You can push and pull changes from remote repositories.

### Push changes

Push changes to a remote repository by providing the path to the repository and the username and password to authenticate.

```python
# Push without authentication (for public repos or SSH)
sandbox.git.push("workspace/repo")

# Push with authentication
sandbox.git.push(
    path="workspace/repo",
    username="user",
    password="github_token"
)
```

### Pull changes

Pull changes from a remote repository by providing the path to the repository and the username and password to authenticate.

```python
# Pull without authentication
sandbox.git.pull("workspace/repo")

# Pull with authentication
sandbox.git.pull(
    path="workspace/repo",
    username="user",
    password="github_token"
)
```

## Advanced operations

Daytona provides additional Git operations through the [Toolbox API](../api/README.md#daytona-toolbox).

### Initialize a repository

Initialize a new Git repository by providing the path to the repository and the name of the first branch. Set `bare` to create a repository without a working tree.

**API:**

```bash
curl 'https://proxy.app.daytona.io/toolbox/{sandboxId}/git/init' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
  "bare": false,
  "initial_branch": "main",
  "path": "workspace/repo"
}'
```

### Reset changes

Reset the current HEAD to the specified state by providing the path to the repository, the mode and the target revision to reset to. Pass `files` to constrain the reset to specific paths.

**API:**

```bash
curl 'https://proxy.app.daytona.io/toolbox/{sandboxId}/git/reset' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
  "files": [],
  "mode": "mixed",
  "path": "workspace/repo",
  "target": "HEAD~1"
}'
```

### Restore files

Restore working tree files or unstage changes by providing the path to the repository, the files to restore, the source revision, and whether to restore from the staged index or working tree.

**API:**

```bash
curl 'https://proxy.app.daytona.io/toolbox/{sandboxId}/git/restore' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
  "files": ["src/main.py"],
  "path": "workspace/repo",
  "source": "",
  "staged": false,
  "worktree": true
}'
```

### Get commit history

Return the commit log for a repository.

**API:**

```bash
curl 'https://proxy.app.daytona.io/toolbox/{sandboxId}/git/history?path=workspace/repo'
```

### Manage remotes

Add a remote or get the URL of a remote by providing the path to the repository, the name of the remote, and the URL of the remote.

1. Set **`fetch`** to **`true`** to fetch from the remote immediately after adding it
2. Set **`overwrite`** to **`true`** to replace an existing remote with the same name

```python
# Add a remote
sandbox.git.remote_add("workspace/repo", "origin", "https://github.com/user/repo.git")

# Add a remote, fetch from it, and replace an existing remote with the same name
sandbox.git.remote_add(
    path="workspace/repo",
    name="upstream",
    url="https://github.com/other/repo.git",
    fetch=True,
    overwrite=True
)

# Get the URL of a remote (None when it does not exist)
url = sandbox.git.remote_get("workspace/repo", "origin")
```

### Configure Git

Read or write Git config values by providing the key and the value. Set **`scope`** to **`local`** together with the repository **`path`** to configure a single repository.

- **Scope**: **`global`** (default), **`local`**, or **`system`**

```python
# Set a config value at the global scope
sandbox.git.set_config("core.editor", "vim")

# Set a config value for a single repository
sandbox.git.set_config(
    key="core.editor",
    value="vim",
    scope="local",
    path="workspace/repo"
)

# Get a config value (None when unset)
editor = sandbox.git.get_config("core.editor")
```

### Configure user

Configure the Git user name and email by providing the `name` and `email` values. Set `scope` to `local` together with the repository `path` to configure the user for a single repository.

- **Scope**: **`global`** (default), **`local`**

```python
# Configure the global Git user
sandbox.git.configure_user("John Doe", "john@example.com")

# Configure the user for a single repository
sandbox.git.configure_user(
    name="John Doe",
    email="john@example.com",
    scope="local",
    path="workspace/repo"
)
```

### Authenticate credentials

Persist Git credentials globally via the credential store by providing the host, protocol, username, and password. Credentials are stored in plaintext on disk.

**API:**

```bash
curl 'https://proxy.app.daytona.io/toolbox/{sandboxId}/git/credentials' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
  "host": "github.com",
  "password": "personal_access_token",
  "protocol": "https",
  "username": "git"
}'
```
