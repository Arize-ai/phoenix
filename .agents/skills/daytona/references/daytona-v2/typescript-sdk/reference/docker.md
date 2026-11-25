# Docker (TypeScript SDK reference)

## Contents

- [DockerService](#dockerservice)
- [DockerOwner](#dockerowner)
- [DockerState](#dockerstate)
- [DockerStatus](#dockerstatus)
- [DockerWaitOptions](#dockerwaitoptions)

## DockerService

Docker Engine status inside the sandbox (`sandbox.docker`). Read-only:
nothing here starts or restarts Docker. The sandbox env variable
`DAYTONA_DOCKER_START` chooses how Docker starts: `auto` (default; start
the image's `dockerd` when it ships one), `entrypoint` (the image's own
entrypoint starts Docker; only wait for it) or `off` (neither start nor
wait; state `disabled`). Unknown values count as `auto`.

If the status endpoint is unavailable, `status()` and `waitUntilReady()`
throw `NotFoundError` (404).

### Constructors

#### Constructor

```ts
new DockerService(token: Internal, init: never): DockerService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `DockerService`

### Methods

#### status()

```ts
status(): Promise<DockerStatus>;
```

Current Docker Engine status for this boot, answered immediately.
Throws `NotFoundError` (404) when the endpoint is unavailable.

**Returns**:

- `Promise<DockerStatus>`

#### waitUntilReady()

```ts
waitUntilReady(options: DockerWaitOptions = {}): Promise<DockerStatus>;
```

Poll the Docker status until it is `ready` and return that status.

Each poll requests a hold of up to one second while Docker is
`starting`; answers that come back sooner are spaced 500 ms apart.
Throws `DockerNotReadyError` as soon as Docker settles in a state
that cannot become `ready` (`failed`, `not_present`, `disabled`,
`unmanaged`, `unsupported`), and `DockerWaitTimeoutError` when the
budget runs out while Docker is still `starting` or `deferred`,
including when a status request is still unanswered at
the deadline. No request runs more than a fraction of a second past the
deadline. `timeoutSeconds: 0`, or a value above about 24.8 days, waits without a deadline.

**Parameters**:

- `options` _DockerWaitOptions = \{\}_

**Returns**:

- `Promise<DockerStatus>`

***

## DockerOwner

```ts
type DockerOwner = 'none' | 'daemon' | 'entrypoint' | 'unknown'
```

***

## DockerState

```ts
type DockerState = 'not_present' | 'disabled' | 'unmanaged' | 'deferred' | 'starting' | 'ready' | 'failed' | 'unsupported' | 'unknown'
```

***

## DockerStatus

**Properties**:

- `owner` _DockerOwner_
- `rawOwner` _string_
- `processId?` _string_
- `reason?` _string_
- `state` _DockerState_
- `rawState` _string_

***

## DockerWaitOptions

**Properties**:

- `timeoutSeconds?` _number_ - Wait budget in seconds. Default 60. `0` (or a value above about 24.8 days) waits without a
  deadline — avoid it for sandboxes whose Docker can stay `deferred`.
