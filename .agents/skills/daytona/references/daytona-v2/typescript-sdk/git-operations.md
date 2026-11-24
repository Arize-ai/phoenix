# Git Operations (TypeScript SDK)

Interact with Git repositories in your sandboxes.

Git operations are the version control actions that let an AI agent or a program work on a Git repository inside a sandbox, from cloning it to pushing a branch for review. Each change is recorded as a commit, so the work of an agent can be reviewed and reverted.

Daytona runs Git operations on repositories inside a sandbox, without shell commands in the sandbox. Each operation acts on one repository at a path in the sandbox, and the repository stays in the sandbox filesystem between operations. Public and private repositories work the same way, and differ only in the credentials that a call passes.

Use Git operations when an agent works on code from a repository in a sandbox, from cloning it to pushing a branch for review. The Git module of the SDKs and the API cover cloning, branching, staging, committing, pushing, pulling, and the commit history.

## Contents

- [Use cases](#use-cases)
- [Clone repositories](#clone-repositories)
- [Get repository status](#get-repository-status)
- [Branch operations](#branch-operations)
- [Stage changes](#stage-changes)
- [Commit changes](#commit-changes)
- [Remote operations](#remote-operations)
- [Initialize a repository](#initialize-a-repository)
- [Reset changes](#reset-changes)
- [Restore files](#restore-files)
- [Get commit history](#get-commit-history)
- [Manage remotes](#manage-remotes)
- [Configure Git](#configure-git)
- [Configure user](#configure-user)
- [Authenticate credentials](#authenticate-credentials)
- [Permissions](#permissions)

## Use cases

Git operations are used when a sandbox works on code that lives in a Git repository.

- **Coding agents.** An agent clones a repository, changes code, commits, and pushes a branch for review. Every step runs through the API, with no shell commands in the sandbox. In the SDKs, clone, push, and pull accept a timeout for each call, with a default of 30 minutes.

- **Branch checks.** A sandbox checks out a branch and runs its tests in isolation. Each branch gets its own sandbox, so one run does not affect another. A clone can also check out a specific commit, which leaves the repository on a detached HEAD.

- **Private repositories.** A username and a personal access token passed with each clone, push, or pull authenticate against private repositories. The credentials are not written to the repository configuration or the remote URL. Without both a username and a password, Git runs without credentials and does not prompt, so the operation fails.

- **Change inspection.** Status, branches, and commit history are read without a shell, for example to show an agent's changes before a commit. Status reports the current branch, how far it is ahead of and behind its upstream, and the state of each changed file. History lists every commit reachable from the current commit, newest first, with the author and timestamp of each.

- **Rollback of failed attempts.** Reset and restore discard uncommitted changes or unstage files. An agent returns the repository to a known commit and tries again. Restore also accepts a commit, a branch, or a tag as its source.

## Clone repositories

Clone a repository to copy it, with its history, into a directory of a sandbox. A clone is a new local repository that holds the commits and branches of a remote repository and remembers that remote as its source. A shallow clone fetches only the most recent commits.

A clone in a sandbox writes a new repository into a directory of the sandbox filesystem. Git runs inside the sandbox until the clone finishes, whether or not the caller still waits for it.

Clone a repository before any other Git operation on its code, or [initialize a repository](#initialize-a-repository) to start one without a remote. When the time limit of a call passes, the clone keeps running, and another clone into the same destination fails because it is not empty. The sandbox stops a clone after 31 minutes while the call still waits. It then removes the partly cloned destination directory, unless the destination directory already existed before the call.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });
```

| **Parameter** | **Description** |
| --- | --- |
| `url` | Sets the repository to clone.<br />**Required**<br />**Format:** a repository URL or a local path<br />**Example:** `'https://github.com/octocat/Spoon-Knife.git'` |
| `path` | Sets the destination directory in the sandbox.<br />**Required**<br />**Format:** an absolute path, or a path relative to the WORKDIR of the image on Linux (the home directory of root when the image sets none or `/`) or to `/Users/lume` on macOS<br />**Example:** `'/home/daytona/workspace/repo'` |
| `branch` | Sets the branch to check out after the clone.<br />**Default:** the default branch of the remote<br />**Example:** `'feature-branch'` |
| `commitId` | Sets the commit to check out after the clone. It takes precedence over branch and leaves the repository on a detached HEAD at that commit. |
| `depth` | Sets the number of commits to fetch for a shallow clone.<br />**Minimum:** `1`<br />**Maximum:** `2147483647`<br />**Example:** `1` |
| `insecureSkipTls` | Skips TLS certificate verification for this clone.<br />**Default:** `false` |
| `password` | Sets the password or personal access token for the remote. |
| `timeoutSeconds` | Sets how long the SDK waits for the call in seconds.<br />**Default:** `1800`<br />**Value:** `0` for no limit<br />**Example:** `600` |
| `username` | Sets the username for the remote.<br />**Example:** `'git'` |

## Get repository status

Get the status of a repository to see what changed since the last commit. The status of a Git repository compares the working tree and the index with the current commit, and compares the current branch with its upstream branch on a remote.

The status of a repository in a sandbox describes it at the moment of the call: its current branch and every file that is changed or untracked since the last commit.

Use the status to check an agent's changes before a [commit](#commit-changes). It also reports whether the current branch has an upstream and how many commits it is ahead of and behind it. Both counts are zero when the branch has no upstream. Each changed file carries its index and working tree state, and each renamed file also carries its original path.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });

const status = await sandbox.git.status('/home/daytona/workspace/repo');
console.log(`Current branch: ${status.currentBranch}`); // "HEAD" when detached
console.log(`Commits ahead: ${status.ahead}, behind: ${status.behind}`);

// staging and worktree hold the porcelain status codes
// (M, A, D, R, ?, ...) or a space when the file is unchanged there.
status.fileStatus?.forEach(file => {
  console.log(`${file.staging}${file.worktree} ${file.name}`);
});
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |

## Branch operations

Branch operations are the actions that manage the branches of a repository. A branch is a movable pointer to one commit, and it moves forward each time a commit lands on it. Branches keep separate lines of work apart in one repository.

A branch of a repository in a sandbox is a local branch of that repository. One branch is checked out at a time, and the working tree holds the files of that branch.

Use branches to keep work apart from the main line. [List branches](#list-branches) to see which exist, [create a branch](#create-branches), [check it out](#check-out-branches) to switch to it, and [delete it](#delete-branches) when the work is merged or no longer needed.

### List branches

List branches to see which lines of work a repository holds. A Git repository holds local branches, which commits land on, and remote-tracking branches, which mirror the branches of a remote.

The branch list of a repository in a sandbox holds the names of its local branches and nothing else. Remote-tracking branches are not part of it.

List branches before you [create](#create-branches) or [check out](#check-out-branches) a branch, to check whether the branch exists.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });

const response = await sandbox.git.listBranches('/home/daytona/workspace/repo');
response.items.forEach(branch => console.log(branch));
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |

### Create branches

Create a branch to start a separate line of work. A new branch points to the same commit as the branch it starts from, and the two move apart as commits land on each.

A new branch in a sandbox repository starts at the current commit. A create does not switch the repository, which stays on the branch that it was on.

Create a branch for separate work, then [check it out](#check-out-branches) to switch to it.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });

// Create new branch
await sandbox.git.createBranch('/home/daytona/workspace/repo', 'new-feature');
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `name` | Sets the name of the new branch.<br />**Required**<br />**Example:** `'new-feature'` |

### Check out branches

Check out a branch to switch the working tree to it. A checkout replaces the files of the working tree with the files of the branch and makes it the current branch, so the next commit lands on it.

A checkout in a sandbox repository switches the working tree to a local branch. When no local branch has the name but exactly one remote has a branch with that name, the checkout creates a local branch that tracks the branch of that remote.

Check out a branch before you commit to it or pull into it. A checkout of any other missing branch fails. To start a new branch, [create it](#create-branches) first, then check it out.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });
await sandbox.git.createBranch('/home/daytona/workspace/repo', 'feature-branch');

// Checkout a branch
await sandbox.git.checkoutBranch('/home/daytona/workspace/repo', 'feature-branch');
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `branch` | Sets the branch to check out.<br />**Required**<br />**Example:** `'feature-branch'` |

### Delete branches

Delete a branch to remove a line of work that is merged or no longer needed. Deleting a branch removes the pointer, not the commits that other branches also hold.

A deletion in a sandbox repository is safe by default, so a branch with commits that are not merged is kept. The branch that is checked out cannot be deleted, forced or not.

Delete a branch after its work is merged. A safe deletion of a branch with unmerged commits fails with a conflict. Force the deletion to remove the branch together with its unmerged commits.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });
await sandbox.git.createBranch('/home/daytona/workspace/repo', 'old-feature');

// Delete a branch
await sandbox.git.deleteBranch('/home/daytona/workspace/repo', 'old-feature');
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `name` | Sets the branch to delete.<br />**Required**<br />**Example:** `'old-feature'` |
| `force` | Deletes the branch even when it has unmerged commits.<br />**Default:** `false` |

## Stage changes

Stage changes to choose which of them the next commit records. Git keeps staged changes in the index, an area between the working tree and the commit history.

The index of a repository in a sandbox holds the staged changes until a commit records them, or until a reset or a restore of those files unstages them.

Stage the files that the next commit must record, then [commit the changes](#commit-changes). Stage at least one file per call. File paths are relative to the repository path that the call sets.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });
await sandbox.fs.writeText('/home/daytona/workspace/repo/README.md', '# Updated\n');

await sandbox.git.add('/home/daytona/workspace/repo', ['README.md']);
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `files` | Sets the files to stage.<br />**Required**<br />**Format:** paths relative to the repository path<br />**Example:** `['README.md']` |

## Commit changes

Commit changes to record the staged changes as a new commit on the current branch. A commit stores the state of the tracked files, its author, a message, and a link to its parent.

A commit in a sandbox repository records the staged changes under the author that the commit itself names. Repository hooks do not run for it, or for any other Git operation on this page.

Commit after you [stage changes](#stage-changes). Every commit requires its own author name and email. They apply to that commit only and are not written to the repository configuration, so the author identity set with [configure user](#configure-user) does not replace them.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });
await sandbox.fs.writeText('/home/daytona/workspace/repo/README.md', '# Updated\n');

// Stage and commit changes
await sandbox.git.add('/home/daytona/workspace/repo', ['README.md']);
const commit = await sandbox.git.commit(
  '/home/daytona/workspace/repo',
  'Update documentation',
  { author: 'John Doe', email: 'john@example.com' }
);
console.log(`Commit hash: ${commit.hash}`);
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `message` | Sets the commit message.<br />**Required**<br />**Example:** `'Update documentation'` |
| `author` | Sets the author name of the commit.<br />**Required**<br />**Example:** `'John Doe'` |
| `email` | Sets the author email of the commit.<br />**Required**<br />**Example:** `'john@example.com'` |
| `allowEmpty` | Allows a commit with nothing staged.<br />**Default:** `false` |

## Remote operations

Remote operations are the actions that exchange commits between a repository and a remote, another copy of the repository that usually lives on a Git host. A push sends local commits to the remote, and a pull brings commits from the remote into a local branch.

A remote operation on a sandbox repository runs Git inside the sandbox, so the sandbox connects to the remote. Credentials that a call passes apply to that call only.

Use remote operations to share the commits of a sandbox for review and to bring in other commits. [Push changes](#push-changes) after a commit, and [pull changes](#pull-changes) to update the current branch. For private repositories, and for every push to a Git host such as GitHub, [authenticate credentials](#authenticate-credentials).

### Push changes

Push changes to send local commits to a remote branch. A push adds them to the remote branch, and it succeeds only when the remote branch has no commits the local branch lacks.

A push from a sandbox repository sends a local branch to the same-named branch on the remote. A new local branch does not need an upstream configured first.

Push after a [commit](#commit-changes) to share the work, for example as a branch for review. Push fails on a detached HEAD or when the remote branch has commits the local branch lacks. Git hosts such as GitHub require credentials for every push, even to a public repository, so the examples authenticate with a username and a personal access token. See [authenticate credentials](#authenticate-credentials).

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/user/repo.git', { path: '/home/daytona/workspace/repo' });
await sandbox.fs.writeText('/home/daytona/workspace/repo/README.md', '# Updated\n');
await sandbox.git.add('/home/daytona/workspace/repo', ['README.md']);
await sandbox.git.commit(
  '/home/daytona/workspace/repo',
  'Update documentation',
  { author: 'John Doe', email: 'john@example.com' }
);

await sandbox.git.push('/home/daytona/workspace/repo', {
  username: 'git',
  password: 'personal_access_token',
});
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `branch` | Sets the local branch to push.<br />**Default:** the current branch<br />**Example:** `'new-feature'` |
| `password` | Sets the password or personal access token for the remote. |
| `remote` | Sets the remote to push to.<br />**Default:** `origin`<br />**Format:** the name of a configured remote<br />**Example:** `'upstream'` |
| `setUpstream` | Sets the pushed branch as the upstream of the local branch.<br />**Default:** `false` |
| `timeoutSeconds` | Sets how long the SDK waits for the call in seconds.<br />**Default:** `1800`<br />**Value:** `0` for no limit<br />**Example:** `600` |
| `username` | Sets the username for the remote.<br />**Example:** `'git'` |

### Pull changes

Pull changes to bring the commits of a remote branch into a local branch. A pull fetches the new commits from the remote and adds them to the local branch, either by moving the branch forward or by merging the two diverged lines of work.

A pull into a sandbox repository updates the current branch from its upstream branch and only fast-forwards it. It never creates a merge commit.

Pull before you push when the remote branch has commits that the local branch lacks. When the local and remote branches have diverged, pull fails with a conflict instead of a merge commit. For private repositories, see [authenticate credentials](#authenticate-credentials).

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });

await sandbox.git.pull('/home/daytona/workspace/repo');
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `branch` | Sets the branch to pull.<br />**Value:** the current branch |
| `password` | Sets the password or personal access token for the remote. |
| `remote` | Sets the remote to pull from.<br />**Default:** the upstream remote of the current branch, or `origin` when branch is set<br />**Format:** the name of a configured remote<br />**Example:** `'upstream'` |
| `timeoutSeconds` | Sets how long the SDK waits for the call in seconds.<br />**Default:** `1800`<br />**Value:** `0` for no limit<br />**Example:** `600` |
| `username` | Sets the username for the remote.<br />**Example:** `'git'` |

## Initialize a repository

Initialize a repository to start an empty one in a directory. A new repository has no commits, and no remote until one is added. A bare repository has no working tree and holds only the history.

A new repository in a sandbox lives in a directory of the sandbox filesystem and starts on its initial branch, which has no commits until the first commit lands on it.

Initialize a repository when the code does not come from a remote, then [add a remote](#manage-remotes) to push it. A new repository can be bare, and its initial branch can take a name.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

await sandbox.git.init('/home/daytona/workspace/repo');
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the directory of the new repository.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `bare` | Creates a bare repository without a working tree.<br />**Default:** `false` |
| `initialBranch` | Sets the name of the initial branch.<br />**Default:** the init.defaultBranch setting of Git<br />**Example:** `'main'` |

## Reset changes

Reset changes to move the current branch to a commit. A reset moves the branch pointer, and depending on its mode it also makes the index and the working tree match that commit.

A reset in a sandbox repository acts on the current branch. Its mode decides whether the index and the working tree follow the branch to the target commit.

Reset to a known commit to discard a failed attempt, or reset files to unstage them. Resetting only files, without a target commit, unstages them. To discard changes in single files without moving the branch, [restore files](#restore-files).

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });

// Reset HEAD and the index to the previous commit, keep the working tree
await sandbox.git.reset('/home/daytona/workspace/repo', { target: 'HEAD~1' });
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `files` | Sets the files to reset, in the `mixed` mode only.<br />**Format:** paths relative to the repository path<br />**Example:** `['README.md']` |
| `mode` | Sets the reset mode.<br />**Default:** `mixed`<br />**Value:** `mixed`, `soft`, `hard`, `merge`, or `keep`<br />**Example:** `'hard'` |
| `target` | Sets the commit to reset to.<br />**Default:** `HEAD`<br />**Example:** `'HEAD~1'` |

## Restore files

Restore files to return them to an earlier state. Restoring a file in the working tree replaces its content, and restoring it in the index replaces its staged version.

A restore in a sandbox repository changes only the named files, and the branch stays where it is.

Restore files to discard their uncommitted changes in the working tree, or to unstage them in the index. To move the branch instead, [reset changes](#reset-changes).

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });
await sandbox.fs.writeText('/home/daytona/workspace/repo/README.md', '# Updated\n');

// Restore a file in the working tree
await sandbox.git.restore('/home/daytona/workspace/repo', ['README.md']);
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `files` | Sets the files to restore. Name at least one file.<br />**Required**<br />**Format:** paths relative to the repository path<br />**Example:** `['README.md']` |
| `source` | Sets the commit, branch, or tag to restore from.<br />**Default:** the index for the working tree, and `HEAD` for the index<br />**Example:** `'HEAD~1'` |
| `staged` | Restores the index entry of each file.<br />**Default:** `false` |
| `worktree` | Restores the working tree copy of each file.<br />**Default:** `true`, or `false` when staged is `true` |

## Get commit history

Get commit history to see the commits that led to the current state of a repository. The history of a branch is every commit reachable from its latest commit through parent links.

The commit history of a sandbox repository covers the current branch: every commit reachable from the current commit, ordered from the newest to the oldest.

Get the history to show what an agent committed, or to find a commit to [reset](#reset-changes) to. It comes in one response, and each entry holds the full hash, message subject, author name and email, and author timestamp. The subject is the first paragraph of the message, its lines joined by spaces. The timestamp keeps the UTC offset that the commit records, as an RFC 3339 string in the API and TypeScript SDK and a timezone-aware datetime in Python.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/octocat/Spoon-Knife.git', { path: '/home/daytona/workspace/repo' });

// Commits are returned newest first
const history = await sandbox.git.history('/home/daytona/workspace/repo');
history.items.forEach(commit => {
  console.log(`${commit.hash}: ${commit.message}`);
  console.log(`  ${commit.author} <${commit.email}> at ${commit.timestamp}`);
});
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |

## Manage remotes

Manage remotes to set where a repository pushes to and pulls from. A remote is a name for the URL of another copy of the repository, and a clone names its source origin.

The remotes of a sandbox repository are stored in that repository, each as a name and a URL.

Add a remote to a repository and list its remotes. Add one after you [initialize a repository](#initialize-a-repository), or to push to another copy of the repository. Listed URLs mask embedded credentials with asterisks. [Push](#push-changes) uses the remote named origin unless the call names another remote.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.init('/home/daytona/workspace/repo');

// Add a remote
await sandbox.git.addRemote('/home/daytona/workspace/repo', 'origin', 'https://github.com/octocat/Spoon-Knife.git');

// List remotes
const remotes = await sandbox.git.listRemotes('/home/daytona/workspace/repo');
remotes.items.forEach(remote => {
  console.log(`${remote.name}: ${remote.url}`);
});
```

| **Parameter** | **Description** |
| --- | --- |
| `path` | Sets the path of the repository in the sandbox.<br />**Required**<br />**Example:** `'/home/daytona/workspace/repo'` |
| `name` | Sets the name of the new remote.<br />**Required**<br />**Example:** `'origin'` |
| `url` | Sets the URL of the new remote.<br />**Required**<br />**Example:** `'https://github.com/octocat/Spoon-Knife.git'` |

## Configure Git

Configure Git to change how it behaves, such as which editor it opens. Git reads its configuration as keys and values, from a global file for a user and from a local file in each repository.

Global Git configuration in a sandbox applies to every repository of the user that Git runs as, and local configuration applies to a single repository only.

Set and get configuration values, globally or for one repository. Git runs as the sandbox default user, or as root when no default user is set. A key must contain a section and a name separated by a dot. Getting a key that is not set returns no value instead of an error.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

// Set a config value at the global scope
await sandbox.git.setConfig('core.editor', 'vim');

// Get a config value (undefined when unset)
const editor = await sandbox.git.getConfig('core.editor');
```

| **Parameter** | **Description** |
| --- | --- |
| `key` | Sets the configuration key.<br />**Required**<br />**Format:** a section and a name separated by a period<br />**Example:** `'core.editor'` |
| `value` | Sets the configuration value.<br />**Required**<br />**Example:** `'vim'` |
| `path` | Sets the path of the repository for the local scope.<br />**Example:** `'/home/daytona/workspace/repo'` |
| `scope` | Sets the configuration scope.<br />**Default:** `global`<br />**Value:** `global` or `local`<br />**Example:** `'local'` |

> **Notes:**
>
> - **Prerequisites:** Setting a value with a [sandbox access token](./sandboxes.md#create-an-access-token) also requires the `toolbox:exec` operation.

## Configure user

Configure the user to set the name and email that Git records as the author of new commits. Git reads both from its configuration, and every commit carries them.

The Git user of a sandbox applies to commits made with Git commands inside the sandbox, such as commits from processes that run there. Commits made through the Git operations on this page carry the author name and email of each call instead.

Configure the user before processes in the sandbox run Git commands that commit. Commits made through the Git module take the author name and email from each [commit](#commit-changes) call. Both are configuration values, set globally or per repository, as [configure Git](#configure-git) describes.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

// Configure the global Git user
await sandbox.git.setConfig('user.name', 'John Doe');
await sandbox.git.setConfig('user.email', 'john@example.com');
```

| **Parameter** | **Description** |
| --- | --- |
| `key` | Sets the configuration key.<br />**Required**<br />**Format:** a section and a name separated by a period<br />**Example:** `'user.name'` |
| `value` | Sets the configuration value.<br />**Required**<br />**Example:** `'John Doe'` |
| `path` | Sets the path of the repository for the local scope.<br />**Example:** `'/home/daytona/workspace/repo'` |
| `scope` | Sets the configuration scope.<br />**Default:** `global`<br />**Value:** `global` or `local`<br />**Example:** `'local'` |

> **Notes:**
>
> - **Prerequisites:** Setting a value with a [sandbox access token](./sandboxes.md#create-an-access-token) also requires the `toolbox:exec` operation.

## Authenticate credentials

Authenticate credentials to give Git access to private remote repositories. A Git host checks a username and a password or a personal access token before it lets a client read or write one.

Credentials in a sandbox apply only to the call that passes them. They are not written to the repository configuration or the remote URL, and they do not appear on the Git command line.

Authenticate clone, push, and pull against private repositories with a username and a personal access token as the password. Credentials apply only when both a username and a password are set. Otherwise, Git runs without credentials and does not prompt, so operations on a private repository fail. On Git hosts such as GitHub, a push needs credentials even to a public repository.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.git.clone('https://github.com/user/repo.git', {
  path: '/home/daytona/workspace/repo',
  username: 'git',
  password: 'personal_access_token',
});

await sandbox.git.push('/home/daytona/workspace/repo', {
  username: 'git',
  password: 'personal_access_token'
});
```

| **Parameter** | **Description** |
| --- | --- |
| `password` | Sets the password or personal access token for the remote. |
| `username` | Sets the username for the remote.<br />**Example:** `'git'` |

## Permissions

Git access runs through the toolbox of a sandbox. Access is governed by one project permission, which you can grant to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

A [sandbox access token](./sandboxes.md#create-an-access-token) with the toolbox:git operation grants the same access to a single sandbox, without an API key. The sandbox read permission alone does not grant toolbox access.

| **Permission**        | **Grants**                                                 |
| --------------------- | ---------------------------------------------------------- |
| **`write:sandboxes`** | Run every Git operation, including clone, status, commit, push, pull, and branch management |
