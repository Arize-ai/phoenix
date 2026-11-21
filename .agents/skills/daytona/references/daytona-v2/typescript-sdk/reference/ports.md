# Ports (TypeScript SDK reference)

## Contents

- [PortsService](#portsservice)
- [PortMapping](#portmapping)
- [ExposePortOptions](#exposeportoptions)
- [ListEndpointsOptions](#listendpointsoptions)
- [SignedPreviewLinkOptions](#signedpreviewlinkoptions)
- [PREVIEW\_WARNING\_SKIP\_HEADER](#previewwarningskipheader)
- [PREVIEW\_WARNING\_SKIP\_HEADER\_VALUE](#previewwarningskipheadervalue)

## PortsService

Sandbox port namespace — what is listening inside the sandbox.

### Constructors

#### Constructor

```ts
new PortsService(token: Internal, init: never): PortsService;
```

Built by the SDK: get it from the client or a sandbox.

**Parameters**:

- `token` _Internal_
- `init` _never_

**Returns**:

- `PortsService`

### Methods

#### expireSignedPreviewLinks()

```ts
expireSignedPreviewLinks(): Promise<void>;
```

Expire every signed preview link of the sandbox before its natural expiry.

Every signed preview link the sandbox has, on every port, stops working.
Links created afterwards work. Unlike minting, expiring still works while
the sandbox is being deleted.

**Returns**:

- `Promise<void>`

**Example:**

```ts
await sandbox.ports.expireSignedPreviewLinks()
```

#### expose()

```ts
expose(port: number, options: ExposePortOptions = {}): Promise<PreviewEndpoint>;
```

Register a sandbox port as a preview endpoint.

If the port is already exposed, returns the existing endpoint (updating its
visibility when `options.public` differs from the current value; the change
takes effect immediately on event delivery, at most 30 s if an event is
missed). Public endpoints need no credential. Programmatic access to a private one needs the
token from `previewLink` (see `PreviewLink`) or a
`signedPreviewLink` URL.
A sandbox that is deleted or being deleted throws `ConflictError` (`CONFLICT`).

**Parameters**:

- `port` _number_ - TCP port inside the sandbox (1–65535, except the sandbox
  daemon's reserved ports 2280, 2281 and 22220).
- `options` _ExposePortOptions = \{\}_

**Returns**:

- `Promise<PreviewEndpoint>`

#### isInUse()

```ts
isInUse(port: number): Promise<boolean>;
```

Whether `port` currently has a listener.

A port outside 1-65535 is refused with `BadRequestError` before any
request. The sandbox answers only for ports 3000-9999 and refuses any
other with `BAD_REQUEST`, so a port such as 80 throws rather than
resolving to a `false` that reads like "nothing is listening there".

**Parameters**:

- `port` _number_

**Returns**:

- `Promise<boolean>`

#### iterEndpoints()

```ts
iterEndpoints(options: ListEndpointsOptions = {}): AsyncIterable<PreviewEndpoint>;
```

**Parameters**:

- `options` _ListEndpointsOptions = \{\}_

**Returns**:

- `AsyncIterable<PreviewEndpoint>`

#### list()

```ts
list(): Promise<ListResult<number>>;
```

Every TCP port currently listening in the sandbox.

**Returns**:

- `Promise<ListResult<number>>`

#### listEndpoints()

```ts
listEndpoints(options: ListEndpointsOptions = {}): Promise<ListResult<PreviewEndpoint>>;
```

One page of the sandbox's preview endpoints.

A sandbox that is deleted or being deleted throws `ConflictError` (`CONFLICT`).

**Parameters**:

- `options` _ListEndpointsOptions = \{\}_

**Returns**:

- `Promise<ListResult<PreviewEndpoint>>`

#### previewLink()

```ts
previewLink(port: number): Promise<PreviewLink>;
```

Preview URL plus access token for one sandbox port.

Callers send the token in the `X-Daytona-Preview-Token` header. Public
endpoints need no token (`token === ''`). The returned link exposes
`expiresAt` when the token expiry is knowable. A client that can
mint (a project key, no caller-supplied token) gets a short-lived sandbox
access token scoped to exactly this port for private endpoints. Otherwise,
or if minting fails, the route token is passed through unchanged.

A port that is not exposed yet is exposed first (privately, as
`expose` does): this call registers a preview endpoint. The sandbox
daemon's ports 2280, 2281 and 22220 are never preview ports: they are
refused with `BadRequestError` before any request, as by `expose`
and `signedPreviewLink`. A sandbox that is deleted or being deleted
throws `ConflictError` (`CONFLICT`).

**Parameters**:

- `port` _number_

**Returns**:

- `Promise<PreviewLink>`

#### signedPreviewLink()

```ts
signedPreviewLink(
   port: number,
   options: SignedPreviewLinkOptions = {}): Promise<SignedPreviewLink>;
```

Return a self-contained signed URL for one sandbox port.

The token is embedded in the hostname, so no extra headers or credentials
are needed — the right choice for handing a URL to a browser, a tool, or
any client that cannot set request headers.

The default lifetime is 60 seconds. Pass a longer `expiresInSeconds` for
multi-step use (the deployment caps the maximum, typically 7 days).
Expire it early with `expireSignedPreviewLinks`, which expires every
signed preview link of the sandbox.
A sandbox that is deleted, being deleted, failed, lost, or stopped without
being persistent throws `ConflictError` (`CONFLICT`).

**Parameters**:

- `port` _number_ - TCP port inside the sandbox (1–65535, except the sandbox
  daemon's reserved ports 2280, 2281 and 22220).
- `options` _SignedPreviewLinkOptions = \{\}_

**Returns**:

- `Promise<SignedPreviewLink>`

**Example:**

```ts
const link = await sandbox.ports.signedPreviewLink(8080, { expiresInSeconds: 300 })
// Hand link.url to a browser or another tool — no headers needed.
```

#### unexpose()

```ts
unexpose(port: number): Promise<void>;
```

Remove a port's preview endpoint; this still works while the sandbox is being deleted.

**Parameters**:

- `port` _number_

**Returns**:

- `Promise<void>`

***

## PortMapping

**Properties**:

- `port` _number_
- `proto?` _'tcp' \| 'udp'_

***

## ExposePortOptions

**Properties**:

- `public?` _boolean_

***

## ListEndpointsOptions

**Properties**:

- `cursor?` _string_
- `limit?` _number_

***

## SignedPreviewLinkOptions

**Properties**:

- `expiresInSeconds?` _number_

***

## PREVIEW\_WARNING\_SKIP\_HEADER

```ts
const PREVIEW_WARNING_SKIP_HEADER = 'X-Daytona-Skip-Preview-Warning'
```

Request header (and its value) that skips the preview warning page. Send it
when a headless browser or another non-interactive client opens a preview URL.

***

## PREVIEW\_WARNING\_SKIP\_HEADER\_VALUE

```ts
const PREVIEW_WARNING_SKIP_HEADER_VALUE = 'true'
```
