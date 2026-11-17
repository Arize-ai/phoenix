# Ports (Python SDK reference)

## Contents

- [PortsService](#portsservice)
- [AsyncPortsService](#asyncportsservice)
- [PortMapping](#portmapping)

## PortsService

```python
class PortsService()
```

Synchronous PortsService.

#### PortsService.\_\_init\_\_

```python
def __init__(impl: AsyncPortsService, bridge: SyncBridge) -> None
```

#### PortsService.expire\_signed\_preview\_link

```python
def expire_signed_preview_link(port: int, token: str) -> None
```

Revoke a signed preview link before its natural expiry.

#### PortsService.expose

```python
def expose(port: int, *, public: bool = False) -> PreviewEndpoint
```

Register a sandbox port as a preview endpoint.

#### PortsService.is\_in\_use

```python
def is_in_use(port: int) -> bool
```

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

#### PortsService.preview\_link

```python
def preview_link(port: int) -> PreviewLink
```

Preview URL plus access token for one sandbox port.

#### PortsService.set\_public

```python
def set_public(port: int, *, public: bool) -> PreviewEndpoint
```

Change the visibility of an exposed port.

#### PortsService.signed\_preview\_link

```python
def signed_preview_link(port: int,
                        *,
                        expires_in_seconds: Optional[int] = None) -> SignedPreviewLink
```

Return a self-contained signed URL for one sandbox port.

#### PortsService.unexpose

```python
def unexpose(port: int) -> None
```

## AsyncPortsService

```python
class AsyncPortsService()
```

#### AsyncPortsService.\_\_init\_\_

```python
def __init__(transport: Optional[AsyncTransport],
             api: Optional[AsyncTransport] = None,
             *,
             sandbox_id: Optional[str] = None,
             mint_preview_token: Optional[Callable[[int], Awaitable[Optional[SandboxAccessToken]]]] = None) -> None
```

#### AsyncPortsService.list

```python
async def list() -> ListResult[int]
```

#### AsyncPortsService.is\_in\_use

```python
async def is_in_use(port: int) -> bool
```

#### AsyncPortsService.list\_endpoints

```python
async def list_endpoints(*,
                         cursor: Optional[str] = None,
                         limit: Optional[int] = None) -> ListResult[PreviewEndpoint]
```

#### AsyncPortsService.iter\_endpoints

```python
async def iter_endpoints(*,
                         cursor: Optional[str] = None,
                         limit: Optional[int] = None) -> AsyncIterator[PreviewEndpoint]
```

#### AsyncPortsService.expose

```python
async def expose(port: int, *, public: bool = False) -> PreviewEndpoint
```

Register a sandbox port as a preview endpoint.

If the port is already exposed, returns the existing endpoint (updating
its visibility if `public` differs from the current value). Public
endpoints need no credential. Programmatic access to a private one
needs the token from `preview_link` (see
`daytona.v2.types.PreviewLink`) or a `signed_preview_link`
URL.

:param port: TCP port inside the sandbox (1–65535).
:param public: When `True` the endpoint is publicly accessible
    without any credential.
:returns: `daytona.v2.types.PreviewEndpoint` with the URL.

#### AsyncPortsService.set\_public

```python
async def set_public(port: int, *, public: bool) -> PreviewEndpoint
```

Change the visibility of an exposed port.

The request replaces the port's preview registration in full, so a
port that is not exposed yet is exposed with this visibility rather
than rejected. Public endpoints need no credential.
Programmatic access to a private one needs the token from
`preview_link` or a `signed_preview_link` URL.

:param port: TCP port inside the sandbox.
:param public: `True` to make the endpoint publicly accessible;
    `False` to restrict it to credentialed callers.
:returns: Updated `daytona.v2.types.PreviewEndpoint`.

#### AsyncPortsService.preview\_link

```python
async def preview_link(port: int) -> PreviewLink
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

#### AsyncPortsService.signed\_preview\_link

```python
async def signed_preview_link(port: int,
                              *,
                              expires_in_seconds: Optional[int] = None) -> SignedPreviewLink
```

Return a self-contained signed URL for one sandbox port.

The token is embedded in the hostname, so no extra headers or credentials
are needed — the right choice for handing a URL to a browser, a tool,
or any client that cannot set request headers.

The default lifetime is 60 seconds. Pass a longer `expires_in_seconds`
for multi-step use (the deployment caps the maximum, typically 7 days).
Revoke the link early with `expire_signed_preview_link`.

:param port: TCP port inside the sandbox (1–65535).
:param expires_in_seconds: Requested token lifetime in seconds (positive
    integer). Omit for the server default (60 s).
:returns: `daytona.v2.types.SignedPreviewLink` with `url`,
    `token`, and `expires_at`.

Example::

    link = await sandbox.ports.signed_preview_link(8080, expires_in_seconds=300)
    # Hand link.url to a browser or another tool — no headers needed.

#### AsyncPortsService.expire\_signed\_preview\_link

```python
async def expire_signed_preview_link(port: int, token: str) -> None
```

Revoke a signed preview link before its natural expiry.

:param port: TCP port the link was issued for.
:param token: The `token` field from `daytona.v2.types.SignedPreviewLink`.

#### AsyncPortsService.unexpose

```python
async def unexpose(port: int) -> None
```

## PortMapping

```python
@dataclass(frozen=True)
class PortMapping()
```

**Attributes**:

- `port` _int_
- `proto` _str = 'tcp'_
