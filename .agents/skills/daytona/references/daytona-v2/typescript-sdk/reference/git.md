# Git (TypeScript SDK reference)

## Contents

- [GitService](#gitservice)
- [CloneOptions](#cloneoptions)
- [CommitOptions](#commitoptions)
- [CredentialOptions](#credentialoptions)
- [DeleteBranchOptions](#deletebranchoptions)
- [GitConfigOptions](#gitconfigoptions)
- [InitOptions](#initoptions)
- [PushOptions](#pushoptions)
- [ResetOptions](#resetoptions)
- [RestoreOptions](#restoreoptions)
- [GitCommit](#gitcommit)
- [GitConfigScope](#gitconfigscope)
- [GitFileStatus](#gitfilestatus)
- [GitRemote](#gitremote)
- [GitStatus](#gitstatus)
- [GitCommitResponse](#gitcommitresponse)

## GitService

Sandbox git namespace (`sandbox.git`).

### Constructors

#### Constructor

```ts
new GitService(token: Internal, ...init: never[]): GitService;
```

Built by the SDK: get it from `sandbox.git`.

**Parameters**:

- `token` _Internal_
- `...init: never[]`

**Returns**:

- `GitService`

### Methods

#### add()

```ts
add(path: string, files: readonly string[]): Promise<void>;
```

Stage an array of string pathspecs (not a bare string).

**Parameters**:

- `path` _string_
- `files` _readonly string\[\]_

**Returns**:

- `Promise<void>`

#### addRemote()

```ts
addRemote(path: string, name: string, url: string): Promise<void>;
```

**Parameters**:

- `path` _string_
- `name` _string_
- `url` _string_

**Returns**:

- `Promise<void>`

#### checkoutBranch()

```ts
checkoutBranch(path: string, branch: string): Promise<void>;
```

**Parameters**:

- `path` _string_
- `branch` _string_

**Returns**:

- `Promise<void>`

#### clone()

```ts
clone(url: string, options: CloneOptions): Promise<void>;
```

Clone a repository, optionally shallow and with per-call TLS relaxation.

**Parameters**:

- `url` _string_
- `options` _CloneOptions_

**Returns**:

- `Promise<void>`

#### commit()

```ts
commit(
   path: string,
   message: string,
   options: CommitOptions): Promise<GitCommitResponse>;
```

Commit staged changes, optionally allowing an empty commit.

**Parameters**:

- `path` _string_
- `message` _string_
- `options` _CommitOptions_

**Returns**:

- `Promise<GitCommitResponse>`

#### createBranch()

```ts
createBranch(path: string, name: string): Promise<void>;
```

**Parameters**:

- `path` _string_
- `name` _string_

**Returns**:

- `Promise<void>`

#### deleteBranch()

```ts
deleteBranch(
   path: string,
   name: string,
   options: DeleteBranchOptions = {}): Promise<void>;
```

Delete a branch. The default is a safe deletion (`git branch -d`): a branch
that is not merged throws `ConflictError` (`CONFLICT`); `{ force: true }`
deletes it anyway (`git branch -D`). The checked-out branch is never
deleted, even with `force` (`ConflictError`); a branch that does not exist
throws `GitBranchNotFoundError`.

**Parameters**:

- `path` _string_
- `name` _string_
- `options` _DeleteBranchOptions = \{\}_

**Returns**:

- `Promise<void>`

#### getConfig()

```ts
getConfig(key: string, options: GitConfigOptions = {}): Promise<string | undefined>;
```

The config value, or undefined when the key is not set.

**Parameters**:

- `key` _string_
- `options` _GitConfigOptions = \{\}_

**Returns**:

- `Promise<string | undefined>`

#### history()

```ts
history(path: string): Promise<ListResult<GitCommit>>;
```

List commits, newest first.

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<ListResult<GitCommit>>`

#### init()

```ts
init(path: string, options: InitOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _InitOptions = \{\}_

**Returns**:

- `Promise<void>`

#### listBranches()

```ts
listBranches(path: string): Promise<ListResult<string>>;
```

List branch names: one page of `{ items }`.

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<ListResult<string>>`

#### listRemotes()

```ts
listRemotes(path: string): Promise<ListResult<GitRemote>>;
```

List the configured remotes; URLs come back with any credentials removed.

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<ListResult<GitRemote>>`

#### pull()

```ts
pull(path: string, options: CredentialOptions = {}): Promise<void>;
```

Pull from the configured or named remote.

**Parameters**:

- `path` _string_
- `options` _CredentialOptions = \{\}_

**Returns**:

- `Promise<void>`

#### push()

```ts
push(path: string, options: PushOptions = {}): Promise<void>;
```

Push to the configured or named remote.

**Parameters**:

- `path` _string_
- `options` _PushOptions = \{\}_

**Returns**:

- `Promise<void>`

#### reset()

```ts
reset(path: string, options: ResetOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _ResetOptions = \{\}_

**Returns**:

- `Promise<void>`

#### restore()

```ts
restore(
   path: string,
   files: readonly string[],
   options: RestoreOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `files` _readonly string\[\]_
- `options` _RestoreOptions = \{\}_

**Returns**:

- `Promise<void>`

#### setConfig()

```ts
setConfig(key: string, value: string, options: GitConfigOptions = {}): Promise<void>;
```

Set a git config value. A sandbox access token needs `toolbox:exec` as
well as `toolbox:git` for this (`toolbox` covers both): without
`toolbox:exec` it throws `ForbiddenError` (403), while `getConfig`
still works.

**Parameters**:

- `key` _string_
- `value` _string_
- `options` _GitConfigOptions = \{\}_

**Returns**:

- `Promise<void>`

#### status()

```ts
status(path: string): Promise<GitStatus>;
```

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<GitStatus>`

***

## CloneOptions

**Properties**:

- `path` _string_ - Where to clone to, inside the sandbox.
- `branch?` _string_
- `commitId?` _string_
- `depth?` _number_ - Shallow clone with this many commits.
- `insecureSkipTls?` _boolean_
- `username?` _string_
- `password?` _string_
- `timeoutSeconds?` _number_ - Request budget in seconds; default 1800.

***

## CommitOptions

**Properties**:

- `author` _string_
- `email` _string_
- `allowEmpty?` _boolean_

***

## CredentialOptions

**Properties**:

- `username?` _string_
- `password?` _string_
- `branch?` _string_
- `remote?` _string_
- `timeoutSeconds?` _number_ - Request budget in seconds; default 1800.

***

## DeleteBranchOptions

Options of `git.deleteBranch()`.

**Properties**:

- `force?` _boolean_ - Delete the branch even when it is not merged (`git branch -D`). Default
  `false`: a safe deletion (`git branch -d`) that refuses an unmerged branch
  with `ConflictError` (`CONFLICT`).

***

## GitConfigOptions

**Properties**:

- `path?` _string_
- `scope?` _GitConfigScope_ - Default `'global'`.

***

## InitOptions

**Properties**:

- `bare?` _boolean_
- `initialBranch?` _string_

***

## PushOptions

**Properties**:

- `username?` _string_
- `password?` _string_
- `branch?` _string_
- `remote?` _string_
- `timeoutSeconds?` _number_ - Request budget in seconds; default 1800.
- `setUpstream?` _boolean_

***

## ResetOptions

**Properties**:

- `mode?` _string_
- `target?` _string_
- `files?` _readonly string\[\]_

***

## RestoreOptions

**Properties**:

- `staged?` _boolean_
- `worktree?` _boolean_
- `source?` _string_

***

## GitCommit

One commit from `git.history()`.

**Properties**:

- `hash` _string_
- `message` _string_
- `author` _string_
- `email` _string_
- `timestamp` _string_ - RFC 3339 author timestamp.

***

## GitConfigScope

```ts
type GitConfigScope = 'global' | 'local'
```

***

## GitFileStatus

One entry of `GitStatus.fileStatus`.

**Properties**:

- `name` _string_
- `staging` _string_
- `worktree` _string_
- `extra` _string_ - For a rename, the original path; otherwise empty.

***

## GitRemote

**Properties**:

- `name` _string_
- `url` _string_

***

## GitStatus

**Properties**:

- `currentBranch` _string_
- `ahead` _number_
- `behind` _number_
- `branchPublished` _boolean_
- `fileStatus` _readonly GitFileStatus\[\]_

***

## GitCommitResponse

**Properties**:

- `hash` _string_
