

## SandboxNode

Lightweight data-plane handle for one node in a multi-node Sandbox.

**Properties**:

- `cpu` _number_
- `disk` _number_
- `fabricAddress?` _string_
- `fabricHealthy?` _boolean_
- `fabricPrefixLength?` _number_
- `fabricUnhealthySince?` _string_
- `failure?` _GangNodeFailure_
- `fs` _FileSystem_
- `gpu` _number_
- `id` _string_
- `incarnation` _number_
- `memory` _number_
- `process` _Process_
- `rank` _number_
- `state` _SandboxState_
- `warnings` _string\[\] = \[\]_ - Advisory RDMA warnings for this node.


### Constructors

#### Constructor

```ts
new SandboxNode(
   node: import("@daytona/api-client").SandboxNode,
   toolboxProxyUrl: string,
   clientConfig: Configuration,
   sandboxApi: SandboxApi,
   language?: string,
   requestTimeoutMs?: number
): SandboxNode;
```

**Parameters**:

- `node` _API SandboxNode DTO_ - Rank, ID, state and resources returned by the API.
- `toolboxProxyUrl` _string_
- `clientConfig` _Configuration_
- `sandboxApi` _SandboxApi_
- `language?` _string_
- `requestTimeoutMs?` _number_


**Returns**:

- `SandboxNode`

**Throws**:

If the node ID is empty, "." or "..".

### Methods

#### createSshAccess()

```ts
createSshAccess(expiresInMinutes?: number): Promise<SshAccessDto>;
```

Create an SSH access token for this node.

**Parameters**:

- `expiresInMinutes?` _number_


**Returns**:

- `Promise<SshAccessDto>`

#### getPreviewLink()

```ts
getPreviewLink(port: number): Promise<PortPreviewUrl>;
```

Get a preview URL for a port on this node.

**Parameters**:

- `port` _number_


**Returns**:

- `Promise<PortPreviewUrl>`

#### revokeSshAccess()

```ts
revokeSshAccess(token: string): Promise<void>;
```

Revoke an SSH access token for this node.

**Parameters**:

- `token` _string_


**Returns**:

- `Promise<void>`

#### update()

```ts
update(node: import("@daytona/api-client").SandboxNode): void;
```

Refresh resources, state, incarnation, failure details and fabric metadata.

**Parameters**:

- `node` _API SandboxNode DTO_ - Node data from the API response, not an SDK node handle.


**Returns**:

- `void`

**Throws**:

If the node rank or id differs from this handle.
