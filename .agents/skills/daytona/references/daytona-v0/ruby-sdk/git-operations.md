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

```ruby
# Basic clone
sandbox.git.clone(
  url: 'https://github.com/user/repo.git',
  path: 'workspace/repo'
)

# Clone with authentication
sandbox.git.clone(
  url: 'https://github.com/user/repo.git',
  path: 'workspace/repo',
  username: 'git',
  password: 'personal_access_token'
)

# Clone specific branch
sandbox.git.clone(
  url: 'https://github.com/user/repo.git',
  path: 'workspace/repo',
  branch: 'develop'
)

# Clone a specific commit (detached HEAD)
sandbox.git.clone(
  url: 'https://github.com/user/repo.git',
  path: 'workspace/repo-old',
  commit_id: 'abc123def456'
)

# Clone from a self-signed internal Git server (insecure)
sandbox.git.clone(
  url: 'https://internal-git.example.com/org/repo.git',
  path: 'workspace/repo',
  insecure_skip_tls: true
)
```

### Get repository status

Get the status of a Git repository by providing the path to the repository.

You can get the current branch, modified files, and the number of commits ahead and behind the upstream tracking branch. When no upstream is configured, `ahead` and `behind` are zero and `branch_published` is false. The response also includes `upstream` (for example `origin/main`) and `detached` when HEAD is not on a branch.

```ruby
# Get repository status
status = sandbox.git.status('workspace/repo')
puts "Current branch: #{status.current_branch}"
puts "Upstream: #{status.upstream}"
puts "Detached HEAD: #{status.detached}"
puts "Commits ahead: #{status.ahead}"
puts "Commits behind: #{status.behind}"
status.file_status.each do |file|
  puts "File: #{file.name}"
end

# List branches
response = sandbox.git.branches('workspace/repo')
puts "Checked out branch: #{response.current}"
response.branches.each do |branch|
  puts "Branch: #{branch}"
end
```

## Branch operations

Daytona provides methods to manage branches in Git repositories. You can create, switch, and delete branches. Checkout accepts a branch name or a commit SHA.

### Create branches

Create a new branch by providing the path to the repository and the name of the new branch.

```ruby
# Create a new branch
sandbox.git.create_branch('workspace/repo', 'new-feature')
```

### Checkout branches or commits

Checkout a branch or commit by providing the path to the repository and the name of the branch or commit SHA. Pass a commit SHA to enter detached HEAD state.

```ruby
# Checkout a branch
sandbox.git.checkout_branch('workspace/repo', 'feature-branch')

# Checkout a commit (detached HEAD)
sandbox.git.checkout_branch('workspace/repo', 'abc123def456')
```

### Delete branches

Delete a branch by providing the path to the repository and the name of the branch.

```ruby
# Delete a branch
sandbox.git.delete_branch('workspace/repo', 'old-feature')
```

## Stage changes

Stage specific files, all changes, or the whole repository by providing the path to the repository and the files to stage.

```ruby
# Stage a single file
sandbox.git.add('workspace/repo', ['file.txt'])
```

## Commit changes

Commit changes by providing the path to the repository, the message, author, and email.

```ruby
# Stage and commit changes
sandbox.git.add('workspace/repo', ['README.md'])
sandbox.git.commit(
  path: 'workspace/repo',
  message: 'Update documentation',
  author: 'John Doe',
  email: 'john@example.com',
  allow_empty: true
)
```

## Remote operations

Daytona provides methods to work with remote repositories in Git. You can push and pull changes from remote repositories.

### Push changes

Push changes to a remote repository by providing the path to the repository and the username and password to authenticate.

```ruby
# Push without authentication (for public repos or SSH)
sandbox.git.push(path: 'workspace/repo')

# Push with authentication
sandbox.git.push(
  path: 'workspace/repo',
  username: 'user',
  password: 'github_token'
)
```

### Pull changes

Pull changes from a remote repository by providing the path to the repository and the username and password to authenticate.

```ruby
# Pull without authentication
sandbox.git.pull(path: 'workspace/repo')

# Pull with authentication
sandbox.git.pull(
  path: 'workspace/repo',
  username: 'user',
  password: 'github_token'
)
```

## Advanced operations

Daytona provides additional Git operations to initialize repositories, reset and restore changes, manage remotes, configure Git, and persist credentials. Commit history is available through the [Toolbox API](../api/README.md#daytona-toolbox) only.

### Initialize a repository

Initialize a new Git repository by providing the path to the repository and the name of the first branch. When no initial branch is provided, the Git default applies. Set `bare` to create a repository without a working tree.

```ruby
# Initialize a repository
sandbox.git.init('workspace/repo')

# Initialize a repository with an initial branch
sandbox.git.init('workspace/repo', initial_branch: 'main')

# Initialize a bare repository
sandbox.git.init('workspace/repo.git', bare: true)
```

### Reset changes

Reset the current HEAD to the specified state by providing the path to the repository, the mode and the target revision to reset to. Pass `files` to constrain the reset to specific paths.

- **Mode**: **`soft`**, **`mixed`** (default), **`hard`**, **`merge`**, or **`keep`**
- **Target**: any revision; defaults to **`HEAD`**

```ruby
# Unstage all changes (mixed reset to HEAD)
sandbox.git.reset('workspace/repo')

# Hard reset to the previous commit
sandbox.git.reset('workspace/repo', mode: 'hard', target: 'HEAD~1')

# Unstage specific files
sandbox.git.reset('workspace/repo', files: ['src/main.rb'])
```

### Restore files

Restore working tree files or unstage changes by providing the path to the repository, the files to restore, the source revision, and whether to restore from the staged index or working tree. When neither `staged` nor `worktree` is set, the working tree is restored, which discards local changes to the files.

```ruby
# Discard working tree changes
sandbox.git.restore('workspace/repo', ['file.txt'])

# Unstage changes
sandbox.git.restore('workspace/repo', ['file.txt'], staged: true)

# Restore file contents from a previous commit
sandbox.git.restore('workspace/repo', ['file.txt'], source: 'HEAD~1')
```

### Get commit history

Return the commit log for a repository.

**API:**

```bash
curl 'https://proxy.app.daytona.io/toolbox/{sandboxId}/git/history?path=workspace/repo'
```

### Manage remotes

List remotes, add a remote, or get the URL of a remote by providing the path to the repository, the name of the remote, and the URL of the remote. Listing returns the name and URL of each remote configured in the repository.

1. Set **`fetch`** to **`true`** to fetch from the remote immediately after adding it
2. Set **`overwrite`** to **`true`** to replace an existing remote with the same name

```ruby
# Add a remote
sandbox.git.remote_add('workspace/repo', 'origin', 'https://github.com/user/repo.git')

# Add a remote, fetch from it, and replace an existing remote with the same name
sandbox.git.remote_add(
  'workspace/repo',
  'upstream',
  'https://github.com/other/repo.git',
  fetch: true,
  overwrite: true
)

# Get the URL of a remote (nil when it does not exist)
url = sandbox.git.remote_get('workspace/repo', 'origin')

# List remotes
response = sandbox.git.remotes('workspace/repo')
response.remotes.each do |remote|
  puts "#{remote.name}: #{remote.url}"
end
```

### Configure Git

Read or write Git config values by providing the key and the value. Set **`scope`** to **`local`** together with the repository **`path`** to configure a single repository.

- **Scope**: **`global`** (default), **`local`**, or **`system`**

```ruby
# Set a config value at the global scope
sandbox.git.set_config('core.editor', 'vim')

# Set a config value for a single repository
sandbox.git.set_config('core.editor', 'vim', scope: 'local', path: 'workspace/repo')

# Get a config value (nil when unset)
editor = sandbox.git.get_config('core.editor')
```

### Configure user

Configure the Git user name and email by providing the `name` and `email` values. Set `scope` to `local` together with the repository `path` to configure the user for a single repository.

- **Scope**: **`global`** (default), **`local`**

```ruby
# Configure the global Git user
sandbox.git.configure_user('John Doe', 'john@example.com')

# Configure the user for a single repository
sandbox.git.configure_user(
  'John Doe',
  'john@example.com',
  scope: 'local',
  path: 'workspace/repo'
)
```

### Authenticate credentials

Persist Git credentials globally via the credential store by providing the host, protocol, username, and password. Subsequent operations against the host authenticate automatically, without passing credentials per operation. Credentials are stored in plaintext on disk.

- **Host**: defaults to **`github.com`**
- **Protocol**: defaults to **`https`**

```ruby
# Persist credentials for github.com over https
sandbox.git.dangerously_authenticate('git', 'personal_access_token')

# Persist credentials for another host
sandbox.git.dangerously_authenticate(
  'git',
  'personal_access_token',
  host: 'gitlab.com',
  protocol: 'https'
)
```

## See Also
- [Python SDK - git-operations](../python-sdk/git-operations.md)
- [TypeScript SDK - git-operations](../typescript-sdk/git-operations.md)
- [Java SDK - git-operations](../java-sdk/git-operations.md)
- [Go SDK - git-operations](../go-sdk/git-operations.md)
