

Daytona provides preview URLs for accessing services running in your sandboxes. Any process listening for HTTP traffic on ports `1` - `65535` can be previewed through a generated URL.

Daytona supports two types of preview URLs, each with a different authentication mechanism:

- [Standard preview URL](#standard-preview-url) uses the sandbox ID in the URL and requires a separate token for authentication. That token is sandbox-wide and cannot be revoked — use it for your own programmatic access, not for sharing
- [Signed preview URL](#signed-preview-url) embeds the authentication token directly in the URL, requiring no headers. The token is bound to a single port, expires, and can be revoked — use it when sharing access with someone else

## Authentication

If a sandbox has its `public` property set to `true`, preview links are publicly accessible without authentication. Otherwise, authentication is required. The authentication mechanism depends on the preview URL type.
> **Note:**
> Standard and signed preview tokens are not interchangeable. The token from `get_preview_link()` is used as a preview access token (sent via the `x-daytona-preview-token` header). The token from `create_signed_preview_url()` is embedded in the URL itself: it cannot be used as a standard preview token, and vice versa.

## Standard preview URL

The standard preview URL includes your sandbox ID in the URL and provides a separate token for authentication.

URL structure: `https://{port}-{sandboxId}.{daytonaProxyDomain}`

Use standard preview URLs for programmatic access and API integrations where you control the HTTP headers.
> **Caution: The standard preview token is a sandbox-wide credential**
> The token returned by `get_preview_link()` is not restricted to the port you requested it for. It authenticates any port of that sandbox, including the ports that control the sandbox itself: the web terminal on `22222`, the toolbox API on `2280`, and the screen recordings dashboard on `33333`. Anyone holding it can run commands in the sandbox and read or write its filesystem.
>
> Treat it like the sandbox's own credential rather than a per-port viewing token, and do not share it. To give someone access to a single port, use a [signed preview URL](#signed-preview-url), which is bound to one port, expires, and can be revoked.

A sandbox that is **stopped and started again** gets a new token, and tokens issued before that stop no longer work — call `get_preview_link()` again to obtain a fresh one. A sandbox **resumed from a paused state keeps its existing token**, and there is no way to revoke a standard preview token. Once issued, assume it stays valid for as long as the sandbox runs.


### Authentication

Authenticate by sending the token in the `x-daytona-preview-token` header:

```bash
curl -H "x-daytona-preview-token: vg5c0ylmcimr8b_v1ne0u6mdnvit6gc0" \
  https://3000-sandbox-123456.proxy.daytona.work
```

## Signed preview URL

The signed preview URL embeds the authentication token directly in the URL, eliminating the need for separate headers. The token persists across sandbox restarts until it expires, or is revoked manually before expiry. Set a custom expiry time for the token:

- Default: `60` seconds
- Minimum: `1` second
- Maximum: `86,400` seconds (24 hours)
- Recommended: `3600` seconds (1 hour)
> **Tip:**
> Always set the `expires_in_seconds` parameter explicitly. The default of 60 seconds is short due to security considerations. Most use cases should use at least 3600 (1 hour).

URL structure: `https://{port}-{token}.{daytonaProxyDomain}`

Use signed preview URLs when sharing links with users who cannot set custom headers, embedding previews in iframes or emails, or creating time-limited shareable links.


### Authentication

The token is embedded in the URL itself, so no additional headers are required:

```bash
curl https://3000-<value>.proxy.daytona.work
```
> **Tip:**
> Port `22222` is used by the [web terminal](../platform/web-terminal.md) to access the terminal using preview URLs.

## Warning page

When opening a preview link in a browser for the first time, Daytona displays a warning page. This warning informs users about potential risks of visiting the preview URL and only appears when loading the link in a browser.

To skip the warning page:

- Send the `X-Daytona-Skip-Preview-Warning: true` header
- Upgrade to [Tier 3](../platform/limits.md)
- Deploy a [custom preview proxy](https://www.daytona.io/docs/en/custom-preview-proxy)

## See Also
- [Python SDK - preview](../python-sdk/preview.md)
- [TypeScript SDK - preview](../typescript-sdk/preview.md)
