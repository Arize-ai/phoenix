# Ports (TypeScript SDK reference)

## Contents

- [PortsService](#portsservice)
- [PortMapping](#portmapping)
- [ExposePortOptions](#exposeportoptions)
- [ListEndpointsOptions](#listendpointsoptions)
- [SignedPreviewLinkOptions](#signedpreviewlinkoptions)
- [SetPortPublicOptions](#setportpublicoptions)
- [PortInUseResponse](#portinuseresponse)
- [PortListResponse](#portlistresponse)

## PortsService

Sandbox port namespace — what is listening inside the sandbox.

### Constructors

#### Constructor

```ts
new PortsService(
   transport: HttpTransport | undefined,
   api?: AxiosInstance,
   sandboxId?: string,
   mintPreviewToken?: (port: number) => Promise<SandboxAccessToken | undefined>): PortsService;
```

**Parameters**:

- `transport` _HttpTransport \| undefined_
- `api?` _AxiosInstance_
- `sandboxId?` _string_
- `mintPreviewToken?` _(port: number) = \> Promise\<SandboxAccessToken \| undefined\>_

**Returns**:

- `PortsService`

### Methods

#### expireSignedPreviewLink()

```ts
expireSignedPreviewLink(port: number, token: string): Promise<void>;
```

Revoke a signed preview link before its natural expiry.

**Parameters**:

- `port` _number_ - TCP port the link was issued for.
- `token` _string_ - The `token` field from `SignedPreviewLink`.

**Returns**:

- `Promise<void>`

#### expose()

```ts
expose(port: number, options: ExposePortOptions = {}): Promise<PreviewEndpoint>;
```

Register a sandbox port as a preview endpoint.

If the port is already exposed, returns the existing endpoint (updating its
visibility when `options.public` differs from the current value). Public
endpoints need no credential. Programmatic access to a private one needs the
token from `previewLink` (see `PreviewLink`) or a
`signedPreviewLink` URL.

**Parameters**:

- `port` _number_ - TCP port inside the sandbox (1–65535).
- `options` _ExposePortOptions = \{\}_

**Returns**:

- `Promise<PreviewEndpoint>`

#### isInUse()

```ts
isInUse(port: number): Promise<boolean>;
```

Whether `port` currently has a listener.

This endpoint accepts 3000-9999 and rejects anything else with
`BAD_REQUEST`, so this deliberately does not clamp or pre-validate: a
caller asking about port 80 should see that error rather than a silent
`false` that reads like "nothing is listening there".

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

**Parameters**:

- `port` _number_

**Returns**:

- `Promise<PreviewLink>`

#### setPublic()

```ts
setPublic(port: number, options: SetPortPublicOptions): Promise<PreviewEndpoint>;
```

Set the visibility of a port, exposing it first when it is not exposed yet
(the same idempotent upsert `expose` performs).

Public endpoints need no credential. Programmatic access to a private one
needs the token from `previewLink` or a `signedPreviewLink`
URL.

**Parameters**:

- `port` _number_ - TCP port inside the sandbox.
- `options` _SetPortPublicOptions_

**Returns**:

- `Promise<PreviewEndpoint>` - Updated `PreviewEndpoint`.

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
Revoke the link early with `expireSignedPreviewLink`.

**Parameters**:

- `port` _number_ - TCP port inside the sandbox (1–65535).
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

## SetPortPublicOptions

**Properties**:

- `public` _boolean_

***

## PortInUseResponse

```ts
type PortInUseResponse = toolbox.PortInUseResponse
```

***

## PortListResponse

```ts
type PortListResponse = toolbox.PortList
```
