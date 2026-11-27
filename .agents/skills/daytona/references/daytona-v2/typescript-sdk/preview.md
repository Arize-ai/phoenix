# Preview URLs (TypeScript SDK)

Access services running in your sandboxes through preview URLs.

Preview URLs are addresses that route HTTP requests from outside a sandbox to a service that listens on a port inside it. A preview URL makes a web server, an API, or a WebSocket endpoint in the sandbox reachable from a browser or another service.

Daytona provides a preview URL for each exposed port of a sandbox. Any process listening for HTTP traffic on that port is reachable through the URL, under the preview domain of the sandbox's region. Each exposed port is private or public, and a private port requires a credential.

Use preview URLs to open a web application that an agent or a developer starts in a sandbox, or to share a link with people who have no account. A standard preview URL takes a separate token, and a signed preview URL carries it in the URL. To serve previews on your own domain, with your own authentication and error pages, place your own proxy in front of preview URLs.

## Contents

- [Use cases](#use-cases)
- [Expose ports](#expose-ports)
- [Create standard preview URLs](#create-standard-preview-urls)
- [Create signed preview URLs](#create-signed-preview-urls)
- [Port operations](#port-operations)
- [Sandbox activity](#sandbox-activity)
- [Use your own proxy](#use-your-own-proxy)
- [Permissions](#permissions)

## Use cases

Preview URLs make a service in a sandbox reachable over HTTP from outside the sandbox.

- **Web application previews.** A web server that an agent or a developer starts in the sandbox opens in a browser. Members of the organization sign in through the browser to reach a private port. Any process that listens for HTTP traffic on a port from 1 to 65535, other than the sandbox daemon ports 2280, 2281, and 22220, can be previewed once its port is exposed.

- **Shareable links.** A signed preview URL carries its token, so anyone with the link reaches the service without headers. Each link is valid for one port and expires at a set time. Revoking signed links revokes every signed link of the sandbox, on every port, and links created afterwards work. The expiry ranges from 1 second to 7 days, with a default of 60 seconds.

- **API and webhook tests.** An HTTP API in the sandbox receives requests from external clients and services. A public port accepts requests from services that cannot send a credential. Clients that control their HTTP headers use the standard preview URL and send the token in a header.

- **Real-time applications.** WebSocket connections and streaming responses pass through preview URLs. Authenticated streams count as activity and reset the idle timeout. A browser WebSocket client cannot set headers, so it passes an API key as the daytona_token query parameter.

- **Custom domains.** A proxy you run in front of preview URLs serves them on your own domain, with your own authentication and error pages. The proxy forwards each request to the standard preview URL with a credential, even for public ports, so the traffic counts as activity. Daytona strips the credential headers before the request reaches the sandbox.

## Expose ports

Expose ports to make a service in a sandbox reachable from outside it. Exposing a port gives a service in a sandbox an outside address that routes requests to the port.

An exposed port of a sandbox is a preview endpoint with its own URL and a visibility that is set per port. A private endpoint requires authentication, and a public one does not.

Expose a sandbox port to create its preview endpoint, or change the visibility of a port that is already exposed. A port is also exposed as a **private** endpoint when you first request its preview URL. Each exposed port is returned with its port, visibility, URL, and creation time. Exposing an already exposed port returns the existing endpoint with the requested visibility.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

// Expose a port publicly
const endpoint = await sandbox.ports.expose(3000, { public: true });
console.log(endpoint.url);

// Change visibility of an already exposed port
await sandbox.ports.expose(3000, { public: false });
```

| **Parameter** | **Description** |
| --- | --- |
| `port` | Sets the sandbox port to expose.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`<br />**Format:** a TCP port other than the sandbox daemon ports 2280, 2281, and 22220<br />**Example:** `3000` |
| `public` | Makes the endpoint public.<br />**Default:** `false` |

## Create standard preview URLs

Create standard preview URLs to reach a service in a sandbox from code that controls its HTTP headers. A URL that carries no credential relies on a separate token in each request.

A standard preview URL of a sandbox holds the bare UUID of the sandbox and the port, under the preview domain of its region. Its sandbox token is bound to the sandbox and grants access to every private endpoint on it. It does not expire and stays the same across restarts.

Use standard preview URLs for programmatic access and API integrations where you control the HTTP headers. The UUID in the URL is not the sandbox ID that the API returns, which is tagged with its [region](./regions.md). The API returns the sandbox token, while the SDKs called with an API key return an access token scoped to the port. The returned token is an empty string for a public endpoint, because that endpoint needs no credential at all.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

const previewInfo = await sandbox.ports.previewLink(3000);

console.log(`URL: ${previewInfo.url}`);
console.log(`Token: ${previewInfo.token}`);

// Use with fetch
const response = await fetch(previewInfo.url, {
  headers: { 'x-daytona-preview-token': previewInfo.token }
});
```

| **Parameter** | **Description** |
| --- | --- |
| `port` | Sets the sandbox port to preview.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`<br />**Format:** a TCP port other than the sandbox daemon ports 2280, 2281, and 22220<br />**Example:** `3000` |

> **Notes:**
>
> - **Lifetime:** The port-scoped access token expires after 1 hour by default, so call previewLink() again for a new one.

### Authenticate requests

Authenticate requests to reach a private preview endpoint. An authenticated request carries a credential that the server checks before it forwards the request to the service.

A private endpoint of a sandbox accepts a preview token or an API key with the sandbox write permission. Every credential is stripped before the request reaches the application.

Send the standard preview token in a header, or an API key as a bearer token. From clients that cannot set headers, such as browser WebSockets, send the API key in the query string instead. Requests without a valid credential are refused, and browsers are redirected to the sign-in page instead.

**CLI:**

```bash
# Send the standard preview token in a header
curl -H "x-daytona-preview-token: 2fa41c900320a20409fd42dbc5629d38" \
  'https://3000-{sandboxUuid}.{previewDomain}'

# Pass the API key in the query string from a client that cannot set headers
curl 'https://3000-{sandboxUuid}.{previewDomain}/?daytona_token=<API_KEY>'
```

| **Flag** | **Description** |
| --- | --- |
| `daytona_token` | Sets an API key from a client that cannot set headers.<br />**Rules:** a query parameter |
| `-H` | Sets a request header. |
| `x-daytona-preview-token` | Sets the standard preview token.<br />**Rules:** a header, not a query parameter |

### Browser sign-in

Browser sign-in is a login flow in which a page that needs a credential redirects the browser to a sign-in page and back. The browser then keeps a session cookie for later requests.

A browser sign-in for a sandbox preview creates a session that is stored in a cookie scoped to that preview hostname and bound to the sandbox and port, so it does not carry over to other ports or sandboxes. A user is authorized when they are a member of the organization that owns the sandbox and hold the sandbox read permission on the sandbox's project.

Open a private preview URL in a browser without a credential, and Daytona redirects the navigation to sign in. Only top-level navigations trigger the redirect, and other requests receive 401. Membership and permissions are re-checked each time the session token is refreshed, so removing a member revokes access within one session token lifetime, 15 minutes by default. Session cookies are stripped before the request reaches your application, and every preview hostname reserves two paths that never reach it.

| **Path**                | **Description**                     |
| ----------------------- | ----------------------------------- |
| `/.daytona-auth/accept` | Completes the sign-in.              |
| `/.daytona-auth/logout` | Ends the session for that hostname. |

| **Request without a credential**                                                                  | **Response**        |
| ------------------------------------------------------------------------------------------------- | ------------------- |
| GET or HEAD request whose Sec-Fetch-Mode header is navigate                                       | Redirect to sign in |
| GET or HEAD request without Sec-Fetch-Mode, with text/html in Accept and no X-Requested-With header | Redirect to sign in |
| Any other request, including API calls, fetch requests, and SDKs                                  | 401                 |

## Create signed preview URLs

Create signed preview URLs to share a link that works without headers. A signed URL embeds its credential in the address, so anyone with the link can use it until it expires or is revoked.

A signed preview URL of a sandbox embeds its token in the hostname in place of the sandbox ID. Each token is valid for a single port and expires after the lifetime that you set.

Use signed preview URLs to share links with users who cannot set custom headers, or to embed previews in iframes and emails. Revoke the signed URLs of a sandbox to cut off access before they expire. Tokens are 54 characters: the letter s followed by 53 lowercase base32 characters (a to z and 2 to 7). Standard and signed preview tokens are not interchangeable.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();

// Create a signed preview URL that expires in 3600 seconds (1 hour)
const signedLink = await sandbox.ports.signedPreviewLink(3000, { expiresInSeconds: 3600 });

console.log(`URL: ${signedLink.url}`);  // Token is embedded in the URL
console.log(`Token: ${signedLink.token}`);
console.log(`Expires at: ${signedLink.expiresAt}`);

// Use directly, no headers needed
const response = await fetch(signedLink.url);

// Revoke every signed URL of the sandbox, on every port, before expiry if needed
await sandbox.ports.expireSignedPreviewLinks();
```

| **Parameter** | **Description** |
| --- | --- |
| `port` | Sets the sandbox port the signed URL opens.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`<br />**Format:** a TCP port other than the sandbox daemon ports 2280, 2281, and 22220<br />**Example:** `3000` |
| `expiresInSeconds` | Sets the lifetime of the signed URL in seconds.<br />**Default:** `60`<br />**Minimum:** `1`<br />**Maximum:** `604800` |

> **Notes:**
>
> - **Effects:** Revoking signed preview URLs revokes every signed preview URL of the sandbox, on every port.

### Token validation

Token validation is the check a server runs on a credential before it serves a request. A server that validates on every request rejects a token once it stops being valid.

A signed preview token is the whole credential for its port, checked on every request.

Open a signed preview URL directly, because the URL holds the token and a request needs nothing else. Minting a signed link for a port that is not yet exposed exposes it as a private endpoint. Minting never changes the visibility of an exposed port. A signed URL works only for the port in its hostname, while its token is valid and not revoked, and while the port is exposed.

**CLI:**

```bash
curl 'https://3000-{token}.{previewDomain}'
```

> **Notes:**
>
> - **Compatibility:** The token is bound to its port, so a request with another port in the hostname fails.
> - **Lifetime:** The port must remain exposed, so after you [unexpose the port](#unexpose-ports), its signed links fail until the port is exposed again. A signed link that has not expired by the time its port is exposed again works again.
> - **Behaviour:** A signed link never creates a browser session and never redirects to sign in, so an invalid, expired, or revoked token fails for browsers and SDKs alike. Revocation reaches every proxy within about one second, and within 30 seconds if a proxy misses the invalidation event.

## Port operations

Port operations inspect the ports of a running sandbox or remove their endpoints. A port is a number that identifies one service at a network address, so several programs can share it.

Port operations on a sandbox act on its preview endpoints and its network listeners, two separate sets. A port with a listener is not reachable by preview URL until it has an endpoint.

Use the operations below to list the exposed ports of a sandbox, remove a preview endpoint, and find the ports that have a listener inside the sandbox.

### List exposed ports

List exposed ports to see which preview endpoints a sandbox has. A paginated list returns its items one page at a time, with a cursor that points to the next page.

The list of exposed ports of a sandbox holds one entry per preview endpoint, ordered by port number. A port with a listener but no endpoint is not in the list.

List the exposed ports to find the URL and visibility of each endpoint. The list returns one page at a time, and each page holds the cursor of the next one. Each endpoint has its port, visibility, URL, and creation time. To find the ports with a listener, see [listening ports](#list-listening-ports).

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.ports.expose(3000);

let cursor: string | undefined;
do {
  const page = await sandbox.ports.listEndpoints({ limit: 50, cursor });
  for (const endpoint of page.items) {
    console.log(endpoint.port, endpoint.public, endpoint.url, endpoint.createdAt);
  }
  cursor = page.nextCursor; // undefined on the last page
} while (cursor);

// Or iterate over every endpoint without handling page cursors
for await (const endpoint of sandbox.ports.iterEndpoints()) {
  console.log(endpoint.port, endpoint.public, endpoint.url);
}
```

| **Parameter** | **Description** |
| --- | --- |
| `cursor` | Continues from a previous page. |
| `limit` | Sets the page size.<br />**Default:** `100`<br />**Minimum:** `1`<br />**Maximum:** `200` |

### Unexpose ports

Unexpose ports to remove their preview endpoints. Unexposing a port removes its outside address, so requests from outside no longer reach it.

An unexposed port of a sandbox has no preview endpoint. Its preview URL and its signed preview URLs stop serving while the port stays unexposed.

Unexpose a port when it no longer needs to be reachable from outside the sandbox. Exposing the port again before a [signed preview URL](#create-signed-preview-urls) expires makes that URL work again, so revoke the signed URLs to cut them off for good. The [standard preview token](#create-standard-preview-urls) is not affected and keeps working for the sandbox's other private endpoints.

```typescript
import { Daytona } from '@daytona/sdk';

const daytona = new Daytona();
const sandbox = await daytona.v2.create();
await sandbox.ports.expose(3000);

await sandbox.ports.unexpose(3000);
```

| **Parameter** | **Description** |
| --- | --- |
| `port` | Sets the exposed port to remove.<br />**Required**<br />**Minimum:** `1`<br />**Maximum:** `65535`<br />**Example:** `3000` |

### List listening ports

List listening ports to find which ports have a program waiting for connections inside a sandbox. A listening port is a port that a program opened to accept connections.

Listening ports of a sandbox come from its network listeners, not its preview endpoints.

List the ports that have a listener inside the sandbox, or check whether one port has a listener, before you request a preview URL for it. The list covers every TCP port with a listener.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Every TCP port with a listener inside the sandbox
const ports = await sandbox.ports.list()
console.log(ports.items)

// Check one port (3000 to 9999)
if (await sandbox.ports.isInUse(3000)) {
  const link = await sandbox.ports.previewLink(3000)
}
```

| **Parameter** | **Description** |
| --- | --- |
| `port` | Sets the port that isInUse() checks for a listener.<br />**Required**<br />**Minimum:** `3000`<br />**Maximum:** `9999`<br />**Example:** `3000` |

## Sandbox activity

Sandbox activity is the traffic that marks a sandbox as in use and resets its idle timer. An idle timer stops unused resources: each sign of use restarts it, and it acts when it runs out.

The activity of a sandbox includes only **authenticated** preview requests. Anonymous requests to public preview endpoints never reset its idle timer.

Authenticate preview requests and streams, including WebSockets, to reset the [idle timeout](./linux-sandboxes.md#timeouts) of their sandbox. A request is authenticated when it carries a credential that [authenticate requests](#authenticate-requests) accepts or a browser sign-in session, or uses a signed preview URL. An authenticated request to a sandbox that is not running wakes it when it can be woken. The request fails while the sandbox starts or when it cannot be woken.

## Use your own proxy

Use your own proxy to serve previews on a custom domain with your own authentication and error pages. A reverse proxy accepts requests on its own domain and forwards each one to the backend server that it selects from the incoming request.

A proxy in front of sandbox previews resolves the sandbox and port from each request and forwards the request to their standard preview URL, with a credential for private endpoints.

Place your own proxy in front of preview URLs to serve previews on a custom domain, such as preview.yourcompany.com. Send one of the two credential headers below even for public endpoints, so that proxy traffic counts as activity. Credentials are stripped before the request reaches the sandbox, and the rest of the path and query string is forwarded unchanged. WebSocket upgrades and streaming responses are proxied automatically.

| **Header**                                | **Description**                         |
| ----------------------------------------- | --------------------------------------- |
| `X-Daytona-Preview-Token: {sandboxToken}` | Sends the preview token of the sandbox. |
| `Authorization: Bearer {apiKey}`          | Sends a Daytona API key.                |

## Permissions

Previews use two permissions, the read and write sandbox permissions of the project, and you can grant each of them to an [organization role](./organizations.md#roles) or an [API key](./api-keys.md).

The [audit logs](./audit-logs.md) record port exposes and unexposes, and preview URL creation and revocation.

| **Permission**        | **Grants**                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **`read:sandboxes`**  | List and get exposed ports, and open private previews in a signed-in browser                                  |
| **`write:sandboxes`** | Expose and unexpose ports, create standard and signed preview URLs, and open private previews with an API key |
