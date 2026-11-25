# Git (Python SDK reference)

## Contents

- [GitService](#gitservice)
- [AsyncGitService](#asyncgitservice)
- [GitFileStatus](#gitfilestatus)
- [GitStatus](#gitstatus)
- [GitCommitResponse](#gitcommitresponse)
- [GitCommit](#gitcommit)
- [GitRemote](#gitremote)
- [GitConfigScope](#gitconfigscope)

## GitService

```python
class GitService()
```

Sandbox git namespace.

#### GitService.\_\_init\_\_

```python
def __init__() -> None
```

#### GitService.add

```python
def add(path: str, files: Sequence[str], /) -> None
```

Stage a sequence of string pathspecs (not a bare string).

#### GitService.add\_remote

```python
def add_remote(path: str, name: str, url: str, /) -> None
```

#### GitService.checkout\_branch

```python
def checkout_branch(path: str, branch: str, /) -> None
```

Checkout a branch.

#### GitService.clone

```python
def clone(url: str,
          path: str,
          /,
          *,
          branch: Optional[str] = None,
          commit_id: Optional[str] = None,
          depth: Optional[int] = None,
          insecure_skip_tls: bool = False,
          username: Optional[str] = None,
          password: Optional[str] = None,
          timeout: Optional[float] = None) -> None
```

Clone a repository, optionally shallow and with per-call TLS relaxation.

#### GitService.commit

```python
def commit(path: str,
           message: str,
           /,
           *,
           author: str,
           email: str,
           allow_empty: bool = False) -> GitCommitResponse
```

Commit staged changes, optionally allowing an empty commit.

#### GitService.create\_branch

```python
def create_branch(path: str, name: str, /) -> None
```

Create a branch.

#### GitService.delete\_branch

```python
def delete_branch(path: str, name: str, /, *, force: bool = False) -> None
```

Delete a branch.

The default is a safe deletion (`git branch -d`): a branch that is
not merged raises `daytona.v2.errors.ConflictError`
(`CONFLICT`). `force=True` deletes it anyway (`git branch -D`).
The checked-out branch is never deleted, even with `force=True`
(`ConflictError`); a branch that does not exist raises
`daytona.v2.errors.GitBranchNotFoundError`.

#### GitService.get\_config

```python
def get_config(key: str,
               /,
               *,
               path: Optional[str] = None,
               scope: GitConfigScope = 'global') -> Optional[str]
```

#### GitService.history

```python
def history(path: str, /) -> ListResult[GitCommit]
```

List commits, newest first.

#### GitService.init

```python
def init(path: str,
         /,
         *,
         bare: bool = False,
         initial_branch: Optional[str] = None) -> None
```

#### GitService.list\_branches

```python
def list_branches(path: str, /) -> ListResult[str]
```

List branch names as \{items, next_cursor\}.

#### GitService.list\_remotes

```python
def list_remotes(path: str, /) -> ListResult[GitRemote]
```

List the configured remotes; URLs come back with any credentials removed.

#### GitService.pull

```python
def pull(path: str,
         /,
         *,
         username: Optional[str] = None,
         password: Optional[str] = None,
         branch: Optional[str] = None,
         remote: Optional[str] = None,
         timeout: Optional[float] = None) -> None
```

Pull from the configured or named remote.

#### GitService.push

```python
def push(path: str,
         /,
         *,
         username: Optional[str] = None,
         password: Optional[str] = None,
         branch: Optional[str] = None,
         remote: Optional[str] = None,
         set_upstream: bool = False,
         timeout: Optional[float] = None) -> None
```

Push to the configured or named remote.

#### GitService.reset

```python
def reset(path: str,
          /,
          *,
          mode: Optional[str] = None,
          target: Optional[str] = None,
          files: Optional[Sequence[str]] = None) -> None
```

#### GitService.restore

```python
def restore(path: str,
            files: Sequence[str],
            /,
            *,
            staged: Optional[bool] = None,
            worktree: Optional[bool] = None,
            source: Optional[str] = None) -> None
```

#### GitService.set\_config

```python
def set_config(key: str,
               value: str,
               /,
               *,
               path: Optional[str] = None,
               scope: GitConfigScope = 'global') -> None
```

Set a git config value.

A sandbox access token needs `toolbox:exec` as well as
`toolbox:git` for this (`toolbox` covers both): without
`toolbox:exec` it raises `ForbiddenError` (403), while
`get_config` still works.

#### GitService.status

```python
def status(path: str, /) -> GitStatus
```

Return git status.

## AsyncGitService

```python
class AsyncGitService()
```

Sandbox git namespace.

#### AsyncGitService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncGitService.clone

```python
async def clone(url: str,
                path: str,
                /,
                *,
                branch: Optional[str] = None,
                commit_id: Optional[str] = None,
                depth: Optional[int] = None,
                insecure_skip_tls: bool = False,
                username: Optional[str] = None,
                password: Optional[str] = None,
                timeout: Optional[float] = None) -> None
```

Clone a repository, optionally shallow and with per-call TLS relaxation.

#### AsyncGitService.init

```python
async def init(path: str,
               /,
               *,
               bare: bool = False,
               initial_branch: Optional[str] = None) -> None
```

#### AsyncGitService.status

```python
async def status(path: str, /) -> GitStatus
```

Return git status.

#### AsyncGitService.list\_branches

```python
async def list_branches(path: str, /) -> ListResult[str]
```

List branch names as \{items, next_cursor\}.

#### AsyncGitService.list\_remotes

```python
async def list_remotes(path: str, /) -> ListResult[GitRemote]
```

List the configured remotes; URLs come back with any credentials removed.

#### AsyncGitService.history

```python
async def history(path: str, /) -> ListResult[GitCommit]
```

List commits, newest first.

#### AsyncGitService.create\_branch

```python
async def create_branch(path: str, name: str, /) -> None
```

Create a branch.

#### AsyncGitService.add\_remote

```python
async def add_remote(path: str, name: str, url: str, /) -> None
```

#### AsyncGitService.delete\_branch

```python
async def delete_branch(path: str, name: str, /, *, force: bool = False) -> None
```

Delete a branch.

The default is a safe deletion (`git branch -d`): a branch that is
not merged raises `daytona.v2.errors.ConflictError`
(`CONFLICT`). `force=True` deletes it anyway (`git branch -D`).
The checked-out branch is never deleted, even with `force=True`
(`ConflictError`); a branch that does not exist raises
`daytona.v2.errors.GitBranchNotFoundError`.

#### AsyncGitService.checkout\_branch

```python
async def checkout_branch(path: str, branch: str, /) -> None
```

Checkout a branch.

#### AsyncGitService.add

```python
async def add(path: str, files: Sequence[str], /) -> None
```

Stage a sequence of string pathspecs (not a bare string).

#### AsyncGitService.reset

```python
async def reset(path: str,
                /,
                *,
                mode: Optional[str] = None,
                target: Optional[str] = None,
                files: Optional[Sequence[str]] = None) -> None
```

#### AsyncGitService.restore

```python
async def restore(path: str,
                  files: Sequence[str],
                  /,
                  *,
                  staged: Optional[bool] = None,
                  worktree: Optional[bool] = None,
                  source: Optional[str] = None) -> None
```

#### AsyncGitService.commit

```python
async def commit(path: str,
                 message: str,
                 /,
                 *,
                 author: str,
                 email: str,
                 allow_empty: bool = False) -> GitCommitResponse
```

Commit staged changes, optionally allowing an empty commit.

#### AsyncGitService.pull

```python
async def pull(path: str,
               /,
               *,
               username: Optional[str] = None,
               password: Optional[str] = None,
               branch: Optional[str] = None,
               remote: Optional[str] = None,
               timeout: Optional[float] = None) -> None
```

Pull from the configured or named remote.

#### AsyncGitService.push

```python
async def push(path: str,
               /,
               *,
               username: Optional[str] = None,
               password: Optional[str] = None,
               branch: Optional[str] = None,
               remote: Optional[str] = None,
               set_upstream: bool = False,
               timeout: Optional[float] = None) -> None
```

Push to the configured or named remote.

#### AsyncGitService.get\_config

```python
async def get_config(key: str,
                     /,
                     *,
                     path: Optional[str] = None,
                     scope: GitConfigScope = 'global') -> Optional[str]
```

#### AsyncGitService.set\_config

```python
async def set_config(key: str,
                     value: str,
                     /,
                     *,
                     path: Optional[str] = None,
                     scope: GitConfigScope = 'global') -> None
```

Set a git config value.

A sandbox access token needs `toolbox:exec` as well as
`toolbox:git` for this (`toolbox` covers both): without
`toolbox:exec` it raises `ForbiddenError` (403), while
`get_config` still works.

## GitFileStatus

```python
@dataclass(frozen=True, kw_only=True)
class GitFileStatus()
```

One entry of `GitStatus.file_status`.

**Attributes**:

- `name` _str_
- `staging` _str_
- `worktree` _str_
- `extra` _str_ - For a rename, the original path; otherwise empty.

## GitStatus

```python
@dataclass(frozen=True, kw_only=True)
class GitStatus()
```

**Attributes**:

- `current_branch` _str_
- `ahead` _int_
- `behind` _int_
- `branch_published` _bool_
- `file_status` _tuple\[GitFileStatus, ...\]_

## GitCommitResponse

```python
@dataclass(frozen=True, kw_only=True)
class GitCommitResponse()
```

**Attributes**:

- `hash` _str_

## GitCommit

```python
@dataclass(frozen=True, kw_only=True)
class GitCommit()
```

One commit from `git.history()`.

**Attributes**:

- `hash` _str_
- `message` _str_
- `author` _str_
- `email` _str_
- `timestamp` _datetime_

## GitRemote

```python
@dataclass(frozen=True, kw_only=True)
class GitRemote()
```

**Attributes**:

- `name` _str_
- `url` _str_

## GitConfigScope

```python
GitConfigScope = Literal['global', 'local']
```

Which git configuration `get_config` / `set_config` read or write:
`"global"` (the default) or `"local"` (a repository's, which needs
`path`).
