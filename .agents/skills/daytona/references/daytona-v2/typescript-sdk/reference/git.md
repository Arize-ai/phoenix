# Git (TypeScript SDK reference)

## Contents

- [GitService](#gitservice)
- [CloneOptions](#cloneoptions)
- [CommitOptions](#commitoptions)
- [CredentialOptions](#credentialoptions)
- [GitCommit](#gitcommit)
- [ListBranchResponse](#listbranchresponse)
- [PushOptions](#pushoptions)
- [ResetOptions](#resetoptions)
- [RestoreOptions](#restoreoptions)
- [GitConfigScope](#gitconfigscope)
- [GitRemote](#gitremote)
- [GitStatus](#gitstatus)
- [GitCommitResponse](#gitcommitresponse)

## GitService

### Constructors

#### Constructor

```ts
new GitService(transport: HttpTransport): GitService;
```

**Parameters**:

- `transport` _HttpTransport_

**Returns**:

- `GitService`

### Methods

#### add()

```ts
add(path: string, files: string[]): Promise<void>;
```

**Parameters**:

- `path` _string_
- `files` _string\[\]_

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
deleteBranch(path: string, name: string): Promise<void>;
```

**Parameters**:

- `path` _string_
- `name` _string_

**Returns**:

- `Promise<void>`

#### getConfig()

```ts
getConfig(key: string, options: GitConfigOptions = {}): Promise<string | null>;
```

**Parameters**:

- `key` _string_
- `options` _GitConfigOptions = \{\}_

**Returns**:

- `Promise<string | null>`

#### history()

```ts
history(path: string): Promise<ListResult<GitCommit>>;
```

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

List branches; response always has `{items,nextCursor}`.

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<ListResult<string>>`

#### listRemotes()

```ts
listRemotes(path: string): Promise<ListResult<GitRemote>>;
```

**Parameters**:

- `path` _string_

**Returns**:

- `Promise<ListResult<GitRemote>>`

#### pull()

```ts
pull(path: string, options: CredentialOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `options` _CredentialOptions = \{\}_

**Returns**:

- `Promise<void>`

#### push()

```ts
push(path: string, options: PushOptions = {}): Promise<void>;
```

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
restore(path: string, files: string[], options: RestoreOptions = {}): Promise<void>;
```

**Parameters**:

- `path` _string_
- `files` _string\[\]_
- `options` _RestoreOptions = \{\}_

**Returns**:

- `Promise<void>`

#### setConfig()

```ts
setConfig(key: string, value: string, options: GitConfigOptions = {}): Promise<void>;
```

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

- `path` _string_
- `branch?` _string_
- `commitId?` _string_
- `depth?` _number_
- `insecureSkipTls?` _boolean_
- `username?` _string_
- `password?` _string_
- `timeout?` _number_

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
- `timeout?` _number_

***

## GitCommit

```ts
type GitCommit = toolbox.CommitInfo
```

One commit returned by `git.history()`.

***

## ListBranchResponse

```ts
type ListBranchResponse = toolbox.BranchList
```

***

## PushOptions

**Properties**:

- `username?` _string_
- `password?` _string_
- `branch?` _string_
- `remote?` _string_
- `timeout?` _number_
- `setUpstream?` _boolean_

***

## ResetOptions

**Properties**:

- `mode?` _string_
- `target?` _string_
- `files?` _string\[\]_

***

## RestoreOptions

**Properties**:

- `staged?` _boolean_
- `worktree?` _boolean_
- `source?` _string_

***

## GitConfigScope

```ts
type GitConfigScope = 'global' | 'local'
```

***

## GitRemote

**Properties**:

- `name` _string_
- `url` _string_

***

## GitStatus

**Properties**:

- `currentBranch` _string_
- `ahead?` _number_
- `behind?` _number_
- `branchPublished?` _boolean_
- `fileStatus?` _Array\<\{ name: string; staging?: string; worktree?: string \}\>_

***

## GitCommitResponse

```ts
type GitCommitResponse = toolbox.CommitResponse
```
