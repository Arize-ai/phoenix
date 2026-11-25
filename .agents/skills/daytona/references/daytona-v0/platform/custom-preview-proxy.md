## Contents

- How it works
- WebSocket support
- Reserved ports
- Proxy headers
- Examples
- See Also



Daytona provides a preview proxy service that can be used to handle [preview URLs](../python-sdk/preview.md) for sandboxes. This gives you full control over the preview experience, including custom domains, authentication, error handling, and styling.

- **Custom domain**: host your proxy under your own domain (e.g., `preview.yourcompany.com`)
- **User authentication**: implement custom authentication logic for private previews
- **Sandbox management**: automatically start stopped sandboxes before forwarding users
- **Custom error pages**: style error pages to match your brand
- **Preview warning control**: disable Daytona's preview warning
- **CORS management**: override Daytona's default CORS settings

## How it works

When a user visits a preview URL, your custom proxy receives the request and can:

1. Authenticate the user using custom logic
2. Check sandbox status and start it if needed
3. Forward the request to the actual sandbox
4. Handle responses with custom styling and error pages
5. Send custom headers to control Daytona's behavior

Your proxy should forward the `X-Forwarded-Host` header with the original request host when proxying requests to Daytona. By default, Daytona appends its own host to this header; see [Preserve X-Forwarded-Host](#preserve-x-forwarded-host) to forward your value unchanged.

## WebSocket support

The preview proxy fully supports WebSocket connections. WebSocket upgrade requests (`Upgrade: websocket`) are automatically detected and proxied. WebSocket connections skip the preview warning page.

## Reserved ports

The following ports are reserved for internal services and always require authentication, even on public sandboxes:

| Port        | Service                                                |
| ----------- | ------------------------------------------------------ |
| **`22222`** | [**Web** terminal](./web-terminal.md)              |
| **`2280`**  | Toolbox (IDE/development interface)                    |
| **`33333`** | Recording dashboard                                    |
| **`5985`**  | Windows Remote Management (Windows sandboxes)          |
| **`47001`** | Windows Remote Management listener (Windows sandboxes) |

Ports **`5985`** and **`47001`** are reserved on Windows sandboxes only. On other sandboxes they are ordinary ports and follow the sandbox's `public` setting.

Your custom proxy should avoid exposing these ports unless you explicitly need access to these services.

## Proxy headers

Your proxy can send special headers to control Daytona's behavior.

### Disable preview warning

To disable Daytona's preview warning page, send:

```
X-Daytona-Skip-Preview-Warning: true
```

The warning page is only shown to browser requests. Accepting it applies only to the preview URL it was shown on, for 24 hours. To skip it for every request, send the header above.

### Disable CORS

Daytona's default CORS policy allows all origins with credentials. To override this and use your own CORS settings, send:

```
X-Daytona-Disable-CORS: true
```

### Disable last activity update

To prevent sandbox last activity updates when previewing, set the `X-Daytona-Skip-Last-Activity-Update` header to `true`. This prevents Daytona from keeping sandboxes that have [auto-stop enabled](../python-sdk/sandboxes.md#auto-stop-interval) in a started state:

```bash
curl -H "X-Daytona-Skip-Last-Activity-Update: true" \
  https://3000-sandbox-123456.proxy.daytona.work
```

### Authentication

For private preview links, send:

```
X-Daytona-Preview-Token: {sandboxToken}
```

The `sandboxToken` can be fetched through the Daytona SDK or API using the [standard preview URL](../python-sdk/preview.md#standard-preview-url) methods.

### Preserve X-Forwarded-Host

By default, Daytona appends its own host to the `X-Forwarded-Host` header, so applications inside the sandbox receive both your proxy's value and Daytona's (e.g., `preview.yourcompany.com, 3000-sandbox-123456.proxy.daytona.work`).

If your application needs to see only the original host, for example to generate absolute URLs or validate the request host:

1. Include a valid **`X-Daytona-Preview-Token`** header (see [authentication](#authentication)). To prevent spoofing, the trust header is only honored on authorized requests; requests without a valid token fall back to the default behavior
2. Set **`X-Forwarded-Host`** to the original request host
3. Send **`X-Daytona-Trust-Forwarded-Host: true`**

Daytona then forwards your `X-Forwarded-Host` value unchanged as the only value. The `X-Daytona-Trust-Forwarded-Host` header itself is never forwarded to the sandbox.

```bash
curl -H "X-Daytona-Trust-Forwarded-Host: true" \
  -H "X-Daytona-Preview-Token: {sandboxToken}" \
  -H "X-Forwarded-Host: preview.yourcompany.com" \
  https://3000-sandbox-123456.proxy.daytona.work
```

## Examples

Examples of custom preview proxies are available on [GitHub](https://github.com/daytonaio/daytona-proxy-samples).

## See Also

- [Python SDK](../python-sdk/README.md)
- [TypeScript SDK](../typescript-sdk/README.md)
- [Java SDK](../java-sdk/README.md)
- [Go SDK](../go-sdk/README.md)
- [Ruby SDK](../ruby-sdk/README.md)
