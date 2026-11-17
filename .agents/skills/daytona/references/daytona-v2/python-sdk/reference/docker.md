# Docker (Python SDK reference)

## Contents

- [DockerService](#dockerservice)
- [AsyncDockerService](#asyncdockerservice)
- [DockerStatus](#dockerstatus)
- [DockerState](#dockerstate)
- [DockerOwner](#dockerowner)

## DockerService

```python
class DockerService()
```

Read-only Docker Engine status. Nothing here starts or restarts Docker.

#### DockerService.\_\_init\_\_

```python
def __init__(impl: AsyncDockerService, bridge: SyncBridge) -> None
```

#### DockerService.status

```python
def status() -> DockerStatus
```

Return the current Docker Engine status for this boot, answered immediately.

#### DockerService.wait\_until\_ready

```python
def wait_until_ready(*,
                     timeout: float = DOCKER_WAIT_DEFAULT_TIMEOUT_SECONDS) -> DockerStatus
```

Poll the Docker status until it is `ready` and return that status.

## AsyncDockerService

```python
class AsyncDockerService()
```

Read-only Docker Engine status. Nothing here starts or restarts Docker.

A sandbox without Docker status support answers `status` and
`wait_until_ready` with a `NotFoundError` (404).

#### AsyncDockerService.\_\_init\_\_

```python
def __init__(transport: AsyncTransport) -> None
```

#### AsyncDockerService.status

```python
async def status() -> DockerStatus
```

Return the current Docker Engine status for this boot, answered immediately.

Raises `NotFoundError` (404) when the sandbox does not support the route.

#### AsyncDockerService.wait\_until\_ready

```python
async def wait_until_ready(*,
                           timeout: float = DOCKER_WAIT_DEFAULT_TIMEOUT_SECONDS) -> DockerStatus
```

Poll the Docker status until it is `ready` and return that status.

`timeout` is the wait budget in seconds (default 60); `0` waits
without a deadline — avoid it for sandboxes whose Docker can stay
`deferred`. Each poll asks the server to hold for up to one second
while Docker is `starting`; answers that come back sooner are spaced
0.5 s apart.

Raises `DockerNotReadyError` as soon as Docker settles in a
state that cannot become `ready` (`failed`, `not_present`,
`disabled`, `unmanaged`, or `unsupported`), and
`DockerWaitTimeoutError` when the budget runs out while Docker
is still `starting` or `deferred` — including
when a status request is still unanswered at the deadline. No request
runs more than a fraction of a second past the deadline.

## DockerStatus

```python
@dataclass(frozen=True)
class DockerStatus()
```

**Attributes**:

- `owner` _DockerOwner_
- `state` _DockerState_
- `process_id` _Optional\[str\] = None_
- `reason` _Optional\[str\] = None_
- `raw_owner` _Optional\[str\] = None_
- `raw_state` _Optional\[str\] = None_

## DockerState

```python
DockerState = Literal['ready', 'starting', 'failed', 'not_present', 'disabled', 'unmanaged', 'deferred', 'unsupported', 'unknown']
```

## DockerOwner

```python
DockerOwner = Literal['daemon', 'entrypoint', 'none', 'unknown']
```
