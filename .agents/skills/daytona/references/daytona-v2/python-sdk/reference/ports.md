# Ports (Python SDK reference)

## Contents

- [PortsService](#portsservice)
- [AsyncPortsService](#asyncportsservice)
- [PortMapping](#portmapping)
- [PREVIEW\_WARNING\_SKIP\_HEADER](#previewwarningskipheader)
- [PREVIEW\_WARNING\_SKIP\_HEADER\_VALUE](#previewwarningskipheadervalue)

## PortsService

```python
class PortsService()
```

Synchronous PortsService.

#### PortsService.\_\_init\_\_

```python
def __init__() -> None
```

#### PortsService.expire\_signed\_preview\_links

```python
def expire_signed_preview_links() -> None
```

Expire every signed preview link of the sandbox before its natural expiry.

Every signed preview link the sandbox has, on every port, stops working.
Links created afterwards work. Unlike minting, expiring still works
while the sandbox is being deleted.

Example::

    sandbox.ports.expire_signed_preview_links()

#### PortsService.expose

```python
def expose(port: int, /, *, public: bool = False) -> PreviewEndpoint
```

Register a sandbox port as a preview endpoint.

If the port is already exposed, returns the existing endpoint (updating
its visibility if `public` differs from the current value; the change
takes effect immediately on event delivery, at most 30 s if an event is
missed). Public endpoints need no credential. Programmatic access to a private one
needs the token from `preview_link` (see
`daytona.v2.types.PreviewLink`) or a `signed_preview_link`
URL.
A sandbox that is deleted or being deleted raises
`daytona.v2.errors.ConflictError` (`CONFLICT`).

:param port: TCP port inside the sandbox (1–65535, except the sandbox
    daemon's reserved ports 2280, 2281 and 22220).
:param public: When `True` the endpoint is publicly accessible
    without any credential.
:returns: `daytona.v2.types.PreviewEndpoint` with the URL.

#### PortsService.is\_in\_use

```python
def is_in_use(port: int, /) -> bool
```

Whether `port` currently has a listener.

A port outside 1–65535 is refused with
`daytona.v2.errors.BadRequestError` before
any request. The sandbox answers only for ports 3000–9999 and refuses
any other with `BAD_REQUEST`, so a port such as 80 raises rather than
returning a `False` that reads like "nothing is listening there".

#### PortsService.iter\_endpoints

```python
def iter_endpoints(*,
                   cursor: Optional[str] = None,
                   limit: Optional[int] = None) -> Iterator[PreviewEndpoint]
```

#### PortsService.list

```python
def list() -> ListResult[int]
```

#### PortsService.list\_endpoints

```python
def list_endpoints(*,
                   cursor: Optional[str] = None,
                   limit: Optional[int] = None) -> ListResult[PreviewEndpoint]
```

One page of the sandbox's preview endpoints.

A sandbox that is deleted or being deleted raises
`daytona.v2.errors.ConflictError` (`CONFLICT`).

#### PortsService.preview\_link

```python
def preview_link(port: int, /) -> PreviewLink
```

Preview URL plus access token for one sandbox port.

Callers send the token in the `X-Daytona-Preview-Token` header.
Public endpoints need no token (`token == ""`). The
returned `daytona.v2.types.PreviewLink` also carries
`expires_at` when the token's expiry is known. For private
endpoints, a handle permitted to mint gets a short-lived sandbox
access token scoped to exactly this
port. Otherwise the preview-url token is passed through unchanged.
Token contents are not used to infer access permissions.

A port that is not exposed yet is exposed first (privately, as
`expose` does): this call registers a preview endpoint. The
sandbox daemon's ports 2280, 2281 and 22220 are never preview ports:
they are refused with `daytona.v2.errors.BadRequestError`
before any request, as by `expose` and
`signed_preview_link`. A sandbox that is deleted or being
deleted raises `daytona.v2.errors.ConflictError`
(`CONFLICT`).

#### PortsService.signed\_preview\_link

```python
def signed_preview_link(port: int,
                        /,
                        *,
                        expires_in_seconds: Optional[int] = None) -> SignedPreviewLink
```

Return a self-contained signed URL for one sandbox port.

The token is embedded in the hostname, so no extra headers or credentials
are needed — the right choice for handing a URL to a browser, a tool,
or any client that cannot set request headers.

The default lifetime is 60 seconds. Pass a longer `expires_in_seconds`
for multi-step use (the deployment caps the maximum, typically 7 days).
Expire it early with `expire_signed_preview_links`, which expires
every signed preview link of the sandbox.
A sandbox that is deleted, being deleted, failed, lost, or stopped
without being persistent raises
`daytona.v2.errors.ConflictError` (`CONFLICT`).

:param port: TCP port inside the sandbox (1–65535, except the sandbox
    daemon's reserved ports 2280, 2281 and 22220).
:param expires_in_seconds: Requested token lifetime in seconds (positive
    integer). Omit for the server default (60 s).
:returns: `daytona.v2.types.SignedPreviewLink` with `url`,
    `token`, and `expires_at`.

Example::

    link = sandbox.ports.signed_preview_link(8080, expires_in_seconds=300)
    # Hand link.url to a browser or another tool — no headers needed.

#### PortsService.unexpose

```python
def unexpose(port: int, /) -> None
```

Remove a port's preview endpoint; this still works while the sandbox is being deleted.

## AsyncPortsService

```python
class AsyncPortsService()
```

#### AsyncPortsService.\_\_init\_\_

```python
def __init__() -> None
```

#### AsyncPortsService.list

```python
async def list() -> ListResult[int]
```

#### AsyncPortsService.is\_in\_use

```python
async def is_in_use(port: int, /) -> bool
```

Whether `port` currently has a listener.

A port outside 1–65535 is refused with
`daytona.v2.errors.BadRequestError` before
any request. The sandbox answers only for ports 3000–9999 and refuses
any other with `BAD_REQUEST`, so a port such as 80 raises rather than
returning a `False` that reads like "nothing is listening there".

#### AsyncPortsService.list\_endpoints

```python
async def list_endpoints(*,
                         cursor: Optional[str] = None,
                         limit: Optional[int] = None) -> ListResult[PreviewEndpoint]
```

One page of the sandbox's preview endpoints.

A sandbox that is deleted or being deleted raises
`daytona.v2.errors.ConflictError` (`CONFLICT`).

#### AsyncPortsService.iter\_endpoints

```python
async def iter_endpoints(*,
                         cursor: Optional[str] = None,
                         limit: Optional[int] = None) -> AsyncIterator[PreviewEndpoint]
```

#### AsyncPortsService.expose

```python
async def expose(port: int, /, *, public: bool = False) -> PreviewEndpoint
```

Register a sandbox port as a preview endpoint.

If the port is already exposed, returns the existing endpoint (updating
its visibility if `public` differs from the current value; the change
takes effect immediately on event delivery, at most 30 s if an event is
missed). Public endpoints need no credential. Programmatic access to a private one
needs the token from `preview_link` (see
`daytona.v2.types.PreviewLink`) or a `signed_preview_link`
URL.
A sandbox that is deleted or being deleted raises
`daytona.v2.errors.ConflictError` (`CONFLICT`).

:param port: TCP port inside the sandbox (1–65535, except the sandbox
    daemon's reserved ports 2280, 2281 and 22220).
:param public: When `True` the endpoint is publicly accessible
    without any credential.
:returns: `daytona.v2.types.PreviewEndpoint` with the URL.

#### AsyncPortsService.preview\_link

```python
async def preview_link(port: int, /) -> PreviewLink
```

Preview URL plus access token for one sandbox port.

Callers send the token in the `X-Daytona-Preview-Token` header.
Public endpoints need no token (`token == ""`). The
returned `daytona.v2.types.PreviewLink` also carries
`expires_at` when the token's expiry is known. For private
endpoints, a handle permitted to mint gets a short-lived sandbox
access token scoped to exactly this
port. Otherwise the preview-url token is passed through unchanged.
Token contents are not used to infer access permissions.

A port that is not exposed yet is exposed first (privately, as
`expose` does): this call registers a preview endpoint. The
sandbox daemon's ports 2280, 2281 and 22220 are never preview ports:
they are refused with `daytona.v2.errors.BadRequestError`
before any request, as by `expose` and
`signed_preview_link`. A sandbox that is deleted or being
deleted raises `daytona.v2.errors.ConflictError`
(`CONFLICT`).

#### AsyncPortsService.signed\_preview\_link

```python
async def signed_preview_link(port: int,
                              /,
                              *,
                              expires_in_seconds: Optional[int] = None) -> SignedPreviewLink
```

Return a self-contained signed URL for one sandbox port.

The token is embedded in the hostname, so no extra headers or credentials
are needed — the right choice for handing a URL to a browser, a tool,
or any client that cannot set request headers.

The default lifetime is 60 seconds. Pass a longer `expires_in_seconds`
for multi-step use (the deployment caps the maximum, typically 7 days).
Expire it early with `expire_signed_preview_links`, which expires
every signed preview link of the sandbox.
A sandbox that is deleted, being deleted, failed, lost, or stopped
without being persistent raises
`daytona.v2.errors.ConflictError` (`CONFLICT`).

:param port: TCP port inside the sandbox (1–65535, except the sandbox
    daemon's reserved ports 2280, 2281 and 22220).
:param expires_in_seconds: Requested token lifetime in seconds (positive
    integer). Omit for the server default (60 s).
:returns: `daytona.v2.types.SignedPreviewLink` with `url`,
    `token`, and `expires_at`.

Example::

    link = await sandbox.ports.signed_preview_link(8080, expires_in_seconds=300)
    # Hand link.url to a browser or another tool — no headers needed.

#### AsyncPortsService.expire\_signed\_preview\_links

```python
async def expire_signed_preview_links() -> None
```

Expire every signed preview link of the sandbox before its natural expiry.

Every signed preview link the sandbox has, on every port, stops working.
Links created afterwards work. Unlike minting, expiring still works
while the sandbox is being deleted.

Example::

    await sandbox.ports.expire_signed_preview_links()

#### AsyncPortsService.unexpose

```python
async def unexpose(port: int, /) -> None
```

Remove a port's preview endpoint; this still works while the sandbox is being deleted.

## PortMapping

```python
@dataclass(frozen=True, kw_only=True)
class PortMapping()
```

**Attributes**:

- `port` _int_
- `proto` _str = 'tcp'_

## PREVIEW\_WARNING\_SKIP\_HEADER

```python
PREVIEW_WARNING_SKIP_HEADER = 'X-Daytona-Skip-Preview-Warning'
```

## PREVIEW\_WARNING\_SKIP\_HEADER\_VALUE

```python
PREVIEW_WARNING_SKIP_HEADER_VALUE = 'true'
```
