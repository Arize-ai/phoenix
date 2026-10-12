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

```go
// Basic clone
err := sandbox.Git.Clone(ctx, "https://github.com/user/repo.git", "workspace/repo")
if err != nil {
	log.Fatal(err)
}

// Clone with authentication
err = sandbox.Git.Clone(ctx, "https://github.com/user/repo.git", "workspace/repo",
	options.WithUsername("git"),
	options.WithPassword("personal_access_token"),
)
if err != nil {
	log.Fatal(err)
}

// Clone specific branch
err = sandbox.Git.Clone(ctx, "https://github.com/user/repo.git", "workspace/repo",
	options.WithBranch("develop"),
)
if err != nil {
	log.Fatal(err)
}

// Clone a specific commit (detached HEAD)
err = sandbox.Git.Clone(ctx, "https://github.com/user/repo.git", "workspace/repo-old",
	options.WithCommitId("abc123def456"),
)
if err != nil {
	log.Fatal(err)
}

// Clone from a self-signed internal Git server (insecure)
err = sandbox.Git.Clone(ctx, "https://internal-git.example.com/org/repo.git", "workspace/repo",
	options.WithInsecureSkipTLS(true),
)
if err != nil {
	log.Fatal(err)
}
```

### Get repository status

Get the status of a Git repository by providing the path to the repository.

You can get the current branch, modified files, and the number of commits ahead and behind the upstream tracking branch. When no upstream is configured, `ahead` and `behind` are zero and `branch_published` is false. The response also includes `upstream` (for example `origin/main`) and `detached` when HEAD is not on a branch.

```go
// Get repository status
status, err := sandbox.Git.Status(ctx, "workspace/repo")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Current branch: %s\n", status.CurrentBranch)
fmt.Printf("Commits ahead: %d\n", status.Ahead)
fmt.Printf("Commits behind: %d\n", status.Behind)
for _, file := range status.FileStatus {
	fmt.Printf("File: %s\n", file.Path)
}

// List branches
branches, err := sandbox.Git.Branches(ctx, "workspace/repo")
if err != nil {
	log.Fatal(err)
}
for _, branch := range branches {
	fmt.Printf("Branch: %s\n", branch)
}
```

## Branch operations

Daytona provides methods to manage branches in Git repositories. You can create, switch, and delete branches. Checkout accepts a branch name or a commit SHA.

### Create branches

Create a new branch by providing the path to the repository and the name of the new branch.

```go
// Create a new branch
err := sandbox.Git.CreateBranch(ctx, "workspace/repo", "new-feature")
if err != nil {
	log.Fatal(err)
}
```

### Checkout branches or commits

Checkout a branch or commit by providing the path to the repository and the name of the branch or commit SHA. Pass a commit SHA to enter detached HEAD state.

```go
// Checkout a branch
err := sandbox.Git.Checkout(ctx, "workspace/repo", "feature-branch")
if err != nil {
	log.Fatal(err)
}

// Checkout a commit (detached HEAD)
err = sandbox.Git.Checkout(ctx, "workspace/repo", "abc123def456")
if err != nil {
	log.Fatal(err)
}
```

### Delete branches

Delete a branch by providing the path to the repository and the name of the branch.

```go
// Delete a branch
err := sandbox.Git.DeleteBranch(ctx, "workspace/repo", "old-feature")
if err != nil {
	log.Fatal(err)
}

// Force delete an unmerged branch
err = sandbox.Git.DeleteBranch(ctx, "workspace/repo", "old-feature",
	options.WithForce(true),
)
if err != nil {
	log.Fatal(err)
}
```

## Stage changes

Stage specific files, all changes, or the whole repository by providing the path to the repository and the files to stage.

```go
// Stage a single file
err := sandbox.Git.Add(ctx, "workspace/repo", []string{"file.txt"})
if err != nil {
	log.Fatal(err)
}

// Stage multiple files
err = sandbox.Git.Add(ctx, "workspace/repo", []string{
	"src/main.py",
	"tests/test_main.py",
	"README.md",
})
if err != nil {
	log.Fatal(err)
}

// Stage whole repository
err = sandbox.Git.Add(ctx, "workspace/repo", []string{"."})
if err != nil {
	log.Fatal(err)
}
```

## Commit changes

Commit changes by providing the path to the repository, the message, author, and email.

```go
// Stage and commit changes
err := sandbox.Git.Add(ctx, "workspace/repo", []string{"README.md"})
if err != nil {
	log.Fatal(err)
}

response, err := sandbox.Git.Commit(ctx, "workspace/repo",
	"Update documentation",
	"John Doe",
	"john@example.com",
	options.WithAllowEmpty(true),
)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Commit SHA: %s\n", response.SHA)
```

## Remote operations

Daytona provides methods to work with remote repositories in Git. You can push and pull changes from remote repositories.

### Push changes

Push changes to a remote repository by providing the path to the repository and the username and password to authenticate.

```go
// Push without authentication (for public repos or SSH)
err := sandbox.Git.Push(ctx, "workspace/repo")
if err != nil {
	log.Fatal(err)
}

// Push with authentication
err = sandbox.Git.Push(ctx, "workspace/repo",
	options.WithPushUsername("user"),
	options.WithPushPassword("github_token"),
)
if err != nil {
	log.Fatal(err)
}
```

### Pull changes

Pull changes from a remote repository by providing the path to the repository and the username and password to authenticate.

```go
// Pull without authentication
err := sandbox.Git.Pull(ctx, "workspace/repo")
if err != nil {
	log.Fatal(err)
}

// Pull with authentication
err = sandbox.Git.Pull(ctx, "workspace/repo",
	options.WithPullUsername("user"),
	options.WithPullPassword("github_token"),
)
if err != nil {
	log.Fatal(err)
}
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

```go
// Add a remote
err := sandbox.Git.RemoteAdd(ctx, "workspace/repo", "origin", "https://github.com/user/repo.git")
if err != nil {
	log.Fatal(err)
}

// Add a remote, fetch from it, and replace an existing remote with the same name
err = sandbox.Git.RemoteAdd(ctx, "workspace/repo", "upstream", "https://github.com/other/repo.git",
	options.WithRemoteFetch(true),
	options.WithRemoteOverwrite(true),
)
if err != nil {
	log.Fatal(err)
}

// Get the URL of a remote (empty string when it does not exist)
url, err := sandbox.Git.RemoteGet(ctx, "workspace/repo", "origin")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Remote URL: %s\n", url)
```

### Configure Git

Read or write Git config values by providing the key and the value. Set **`scope`** to **`local`** together with the repository **`path`** to configure a single repository.

- **Scope**: **`global`** (default), **`local`**, or **`system`**

```go
// Set a config value at the global scope
err := sandbox.Git.SetConfig(ctx, "core.editor", "vim")
if err != nil {
	log.Fatal(err)
}

// Set a config value for a single repository
err = sandbox.Git.SetConfig(ctx, "core.editor", "vim",
	options.WithConfigScope("local"),
	options.WithConfigPath("workspace/repo"),
)
if err != nil {
	log.Fatal(err)
}

// Get a config value
editor, err := sandbox.Git.GetConfig(ctx, "core.editor")
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Editor: %s\n", editor)
```

### Configure user

Configure the Git user name and email by providing the `name` and `email` values. Set `scope` to `local` together with the repository `path` to configure the user for a single repository.

- **Scope**: **`global`** (default), **`local`**

```go
// Configure the global Git user
err := sandbox.Git.ConfigureUser(ctx, "John Doe", "john@example.com")
if err != nil {
	log.Fatal(err)
}

// Configure the user for a single repository
err = sandbox.Git.ConfigureUser(ctx, "John Doe", "john@example.com",
	options.WithConfigScope("local"),
	options.WithConfigPath("workspace/repo"),
)
if err != nil {
	log.Fatal(err)
}
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
- [TypeScript SDK - git-operations](../typescript-sdk/git-operations.md)
- [Java SDK - git-operations](../java-sdk/git-operations.md)
