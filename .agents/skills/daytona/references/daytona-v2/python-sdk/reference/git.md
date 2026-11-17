# Git (Python SDK reference)

## Contents

- [GitService](#gitservice)
- [AsyncGitService](#asyncgitservice)
- [GitCommitResponse](#gitcommitresponse)
- [GitStatus](#gitstatus)

## GitService

```python
class GitService()
```

Sandbox git namespace.

#### GitService.\_\_init\_\_

```python
def __init__(impl: AsyncGitService, bridge: SyncBridge) -> None
```

#### GitService.add

```python
def add(path: str, files: Sequence[str]) -> None
```

Stage files.

#### GitService.add\_remote

```python
def add_remote(path: str, name: str, url: str) -> None
```

#### GitService.checkout\_branch

```python
def checkout_branch(path: str, branch: str) -> None
```

Checkout a branch.

#### GitService.clone

```python
def clone(url: str,
          path: str,
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
           *,
           author: str,
           email: str,
           allow_empty: bool = False) -> GitCommitResponse
```

Commit staged changes, optionally allowing an empty commit.

#### GitService.create\_branch

```python
def create_branch(path: str, name: str) -> None
```

Create a branch.

#### GitService.delete\_branch

```python
def delete_branch(path: str, name: str) -> None
```

Delete a branch.

#### GitService.get\_config

```python
def get_config(key: str,
               *,
               path: Optional[str] = None,
               scope: str = 'global') -> Optional[str]
```

#### GitService.history

```python
def history(path: str) -> ListResult
```

List commits, newest first.

#### GitService.init

```python
def init(path: str, *, bare: bool = False, initial_branch: Optional[str] = None) -> None
```

#### GitService.list\_branches

```python
def list_branches(path: str) -> ListResult
```

List branch names as \{items, next_cursor\}.

#### GitService.list\_remotes

```python
def list_remotes(path: str) -> ListResult[JsonObject]
```

#### GitService.pull

```python
def pull(path: str,
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
          *,
          mode: Optional[str] = None,
          target: Optional[str] = None,
          files: Optional[Sequence[str]] = None) -> None
```

#### GitService.restore

```python
def restore(path: str,
            files: Sequence[str],
            *,
            staged: Optional[bool] = None,
            worktree: Optional[bool] = None,
            source: Optional[str] = None) -> None
```

#### GitService.set\_config

```python
def set_config(key: str,
               value: str,
               *,
               path: Optional[str] = None,
               scope: str = 'global') -> None
```

#### GitService.status

```python
def status(path: str) -> GitStatus
```

Return git status.

## AsyncGitService

```python
class AsyncGitService()
```

Sandbox git namespace.

#### AsyncGitService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncGitService.clone

```python
async def clone(url: str,
                path: str,
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
               *,
               bare: bool = False,
               initial_branch: Optional[str] = None) -> None
```

#### AsyncGitService.status

```python
async def status(path: str) -> GitStatus
```

Return git status.

#### AsyncGitService.list\_branches

```python
async def list_branches(path: str) -> ListResult
```

List branch names as \{items, next_cursor\}.

#### AsyncGitService.list\_remotes

```python
async def list_remotes(path: str) -> ListResult[JsonObject]
```

#### AsyncGitService.history

```python
async def history(path: str) -> ListResult
```

List commits, newest first.

#### AsyncGitService.create\_branch

```python
async def create_branch(path: str, name: str) -> None
```

Create a branch.

#### AsyncGitService.add\_remote

```python
async def add_remote(path: str, name: str, url: str) -> None
```

#### AsyncGitService.delete\_branch

```python
async def delete_branch(path: str, name: str) -> None
```

Delete a branch.

#### AsyncGitService.checkout\_branch

```python
async def checkout_branch(path: str, branch: str) -> None
```

Checkout a branch.

#### AsyncGitService.add

```python
async def add(path: str, files: Sequence[str]) -> None
```

Stage files.

#### AsyncGitService.reset

```python
async def reset(path: str,
                *,
                mode: Optional[str] = None,
                target: Optional[str] = None,
                files: Optional[Sequence[str]] = None) -> None
```

#### AsyncGitService.restore

```python
async def restore(path: str,
                  files: Sequence[str],
                  *,
                  staged: Optional[bool] = None,
                  worktree: Optional[bool] = None,
                  source: Optional[str] = None) -> None
```

#### AsyncGitService.commit

```python
async def commit(path: str,
                 message: str,
                 *,
                 author: str,
                 email: str,
                 allow_empty: bool = False) -> GitCommitResponse
```

Commit staged changes, optionally allowing an empty commit.

#### AsyncGitService.pull

```python
async def pull(path: str,
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
                     *,
                     path: Optional[str] = None,
                     scope: str = 'global') -> Optional[str]
```

#### AsyncGitService.set\_config

```python
async def set_config(key: str,
                     value: str,
                     *,
                     path: Optional[str] = None,
                     scope: str = 'global') -> None
```

## GitCommitResponse

```python
GitCommitResponse = _gen.toolbox.CommitResponse
```

## GitStatus

```python
GitStatus = _gen.toolbox.StatusResponse
```
