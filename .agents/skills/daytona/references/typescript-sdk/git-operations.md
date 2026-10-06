## Contents

- Basic operations
- Branch operations
- Stage changes
- Commit changes
- Remote operations
- Advanced operations
- See Also




Git operations are available through the `git` module of a sandbox. Operations run through the Daytona API, so your application works with repositories in a sandbox directly, without installing Git clients or executing shell commands inside it.

The `git` module covers cloning repositories, checking status, managing branches, staging and committing changes, pushing and pulling with authentication, and inspecting commit history. Private repositories authenticate with personal access tokens passed per operation.

## Basic operations

Daytona provides methods to clone, check status, and manage Git repositories in sandboxes.

Git operations assume you are operating in the sandbox user's home directory (e.g. `workspace` implies `/home/[username]/workspace`). Use a leading `/` when providing absolute paths.

### Clone repositories

Clone a Git repository into a sandbox by providing the URL and path to clone it to. You can clone public or private repositories, specific branches or commits, and authenticate using personal access tokens.

```typescript
// Basic clone
await sandbox.git.clone(
    "https://github.com/user/repo.git",
    "workspace/repo"
);

// Clone with authentication
await sandbox.git.clone(
    "https://github.com/user/repo.git",
    "workspace/repo",
    undefined,
    undefined,
    "git",
    "personal_access_token"
);

// Clone specific branch
await sandbox.git.clone(
    "https://github.com/user/repo.git",
    "workspace/repo",
    "develop"
);

// Clone a specific commit (detached HEAD)
await sandbox.git.clone(
    "https://github.com/user/repo.git",
    "workspace/repo-old",
    undefined,
    "abc123def456"
);

// Clone from a self-signed internal Git server (insecure)
await sandbox.git.clone(
    "https://internal-git.example.com/org/repo.git",
    "workspace/repo",
    undefined,
    undefined,
    undefined,
    undefined,
    true
);
```

### Get repository status

Get the status of a Git repository by providing the path to the repository.

You can get the current branch, modified files, and the number of commits ahead and behind the upstream tracking branch. When no upstream is configured, `ahead` and `behind` are zero and `branch_published` is false. The response also includes `upstream` (for example `origin/main`) and `detached` when HEAD is not on a branch.

```typescript
// Get repository status
const status = await sandbox.git.status("workspace/repo");
console.log(`Current branch: ${status.currentBranch}`);
console.log(`Upstream: ${status.upstream}`);
console.log(`Detached HEAD: ${status.detached}`);
console.log(`Commits ahead: ${status.ahead}`);
console.log(`Commits behind: ${status.behind}`);
status.fileStatus.forEach(file => {
    console.log(`File: ${file.name}`);
});

// List branches
const response = await sandbox.git.branches("workspace/repo");
console.log(`Checked out branch: ${response.current}`);
response.branches.forEach(branch => {
    console.log(`Branch: ${branch}`);
});
```

## Branch operations

Daytona provides methods to manage branches in Git repositories. You can create, switch, and delete branches. Checkout accepts a branch name or a commit SHA.

### Create branches

Create a new branch by providing the path to the repository and the name of the new branch.

```typescript
// Create new branch
await sandbox.git.createBranch('workspace/repo', 'new-feature');
```

### Checkout branches or commits

Checkout a branch or commit by providing the path to the repository and the name of the branch or commit SHA. Pass a commit SHA to enter detached HEAD state.

```typescript
// Checkout a branch
await sandbox.git.checkoutBranch('workspace/repo', 'feature-branch');

// Checkout a commit (detached HEAD)
await sandbox.git.checkoutBranch('workspace/repo', 'abc123def456');
```

### Delete branches

Delete a branch by providing the path to the repository and the name of the branch.

```typescript
// Delete a branch
await sandbox.git.deleteBranch('workspace/repo', 'old-feature');
```

## Stage changes

Stage specific files, all changes, or the whole repository by providing the path to the repository and the files to stage.

```typescript
// Stage a single file
await sandbox.git.add('workspace/repo', ['file.txt']);

// Stage multiple files
await sandbox.git.add('workspace/repo', [
  'src/main.ts',
  'tests/main.test.ts',
  'README.md',
]);

// Stage whole repository
await sandbox.git.add('workspace/repo', ['.']);
```

## Commit changes

Commit changes by providing the path to the repository, the message, author, and email.

```typescript
// Stage and commit changes
await sandbox.git.add('workspace/repo', ['README.md']);
await sandbox.git.commit(
  'workspace/repo',
  'Update documentation',
  'John Doe',
  'john@example.com',
  true
);
```

## Remote operations

Daytona provides methods to work with remote repositories in Git. You can push and pull changes from remote repositories.

### Push changes

Push changes to a remote repository by providing the path to the repository and the username and password to authenticate.

```typescript
// Push to a public repository
await sandbox.git.push('workspace/repo');

// Push to a private repository
await sandbox.git.push(
  'workspace/repo',
  'user',
  'token'
);
```

### Pull changes

Pull changes from a remote repository by providing the path to the repository and the username and password to authenticate.

```typescript
// Pull from a public repository
await sandbox.git.pull('workspace/repo');

// Pull from a private repository
await sandbox.git.pull(
  'workspace/repo',
  'user',
  'token'
);
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

```typescript
// Add a remote
await sandbox.git.remoteAdd('workspace/repo', 'origin', 'https://github.com/user/repo.git');

// Add a remote, fetch from it, and replace an existing remote with the same name
await sandbox.git.remoteAdd(
  'workspace/repo',
  'upstream',
  'https://github.com/other/repo.git',
  true,
  true
);

// Get the URL of a remote (undefined when it does not exist)
const url = await sandbox.git.remoteGet('workspace/repo', 'origin');
```

### Configure Git

Read or write Git config values by providing the key and the value. Set **`scope`** to **`local`** together with the repository **`path`** to configure a single repository.

- **Scope**: **`global`** (default), **`local`**, or **`system`**

```typescript
// Set a config value at the global scope
await sandbox.git.setConfig('core.editor', 'vim');

// Set a config value for a single repository
await sandbox.git.setConfig('core.editor', 'vim', 'local', 'workspace/repo');

// Get a config value (undefined when unset)
const editor = await sandbox.git.getConfig('core.editor');
```

### Configure user

Configure the Git user name and email by providing the `name` and `email` values. Set `scope` to `local` together with the repository `path` to configure the user for a single repository.

- **Scope**: **`global`** (default), **`local`**

```typescript
// Configure the global Git user
await sandbox.git.configureUser('John Doe', 'john@example.com');

// Configure the user for a single repository
await sandbox.git.configureUser(
  'John Doe',
  'john@example.com',
  'local',
  'workspace/repo'
);
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

## See Also
- [Python SDK - git-operations](../python-sdk/git-operations.md)
