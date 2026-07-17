# OAuth2 Authorization Server and CLI Login

## Table of Contents

| # | Section | Focus |
|---|---------|-------|
| 1 | [Executive Summary](#executive-summary) | What we built |
| 2 | [Architecture](#architecture) | Components and the authorization-code flow |
| 3 | [Data Model](#data-model) | New tables and token-table columns |
| 4 | [Endpoints](#endpoints) | The authorization-server HTTP surface |
| 5 | [Redirect URI Model](#redirect-uri-model) | Three delivery classes and why |
| 6 | [Dynamic Client Registration](#dynamic-client-registration) | Policy dial and registration hygiene |
| 7 | [CLI Login](#cli-login) | `px auth login` end to end |
| 8 | [MCP as a Protected Resource](#mcp-as-a-protected-resource) | The `/mcp` mount, the 401 challenge, and per-resource discovery |
| 9 | [Design Decisions](#design-decisions) | Major choices and rationale |
| 10 | [Testing](#testing) | Layered unit and integration strategy |
| — | [Appendix: Environment Variables](#appendix-environment-variables) | Configuration surface |
| — | [Appendix: Standards Compliance](#appendix-standards-compliance) | RFC-by-RFC summary |
| — | [Appendix: Lessons Learned](#appendix-lessons-learned) | Root-path and SPA navigation pitfalls |

---

## Executive Summary

### What We Built

Phoenix is now an OAuth2 **authorization server**: third-party applications can
obtain Phoenix bearer tokens through the standard authorization-code flow with
PKCE, with the user approving access on a consent page. Before this work,
Phoenix was only an OAuth2/OIDC **client** (signing users in via external
identity providers); it had no way to issue its own tokens to another
application short of a human copying an API key.

- **Authorization-code + PKCE (S256) flow** — browser consent, one-time hashed
  codes, token exchange for Phoenix's existing access/refresh token pair
- **`px auth login`** — the Phoenix CLI performs the full flow with an
  ephemeral loopback callback server, stores tokens per profile, and
  auto-refreshes them
- **Dynamic Client Registration (RFC 7591)** — agent platforms (Claude Code,
  Cursor, VS Code, Codex CLI, and other MCP hosts) can self-register without
  an admin pre-provisioning a client, governed by a three-position policy dial
- **Discovery** — RFC 8414 authorization-server metadata and RFC 9728
  protected-resource metadata, so standards-aware clients configure themselves
  from two well-known URLs
- **An MCP endpoint as a protected resource** — a minimal MCP server mounted
  at `/mcp` whose unauthenticated callers are challenged with the RFC 9728
  metadata pointer, exercising the full discovery → registration → consent →
  token chain against real MCP clients (MCP Inspector, Cursor, Claude Code)
- **Revocation (RFC 7009)** and **refresh-token rotation** with grant-level
  lifecycle (a durable `oauth2_grants` record per approval, revocable as a unit)
- **Zero new dependencies** — stdlib crypto plus the `joserfc`/`pydantic`
  already in the tree

Authorization *semantics* (what a granted token is permitted to do) are
governed by a separate scope/permission workstream and are deliberately out of
scope for this document; everything here is the protocol machinery.

### Key Files

| File | Purpose |
|------|---------|
| `src/phoenix/server/api/routers/oauth2_authorization_server.py` | Endpoint implementations (authorize, token, revoke, register, metadata) |
| `src/phoenix/server/oauth2_authorization_server.py` | Pure validation logic: PKCE, redirect URIs, state, resource identifiers |
| `src/phoenix/db/migrations/versions/132d988c5bef_*.py` | The one migration: three new tables + token-table columns |
| `src/phoenix/db/facilitator.py` | First-party `phoenix-cli` client seeding, expired-code sweep |
| `app/src/pages/auth/OAuth2ConsentPage.tsx` | SPA consent page |
| `js/packages/phoenix-cli/src/oauth.ts` | CLI-side PKCE, loopback callback server, token exchange/refresh/revoke |
| `js/packages/phoenix-cli/src/commands/auth.ts` | `px auth login` / `status` / `logout` |
| `src/phoenix/server/api/routers/auth_md.py` | RFC 9728 protected-resource metadata (deployment-wide and per-resource `/mcp`) |
| `src/phoenix/server/mcp_server.py` | The MCP mount: `MountPathNormalizer`, `BearerAuthGuard` 401 challenge |

---

## Architecture

### Components

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Authorization-server routers (FastAPI)                                 │
│   ══════════════════════════════════════                                 │
│   • /.well-known/oauth-authorization-server   (RFC 8414 metadata)        │
│   • /oauth2/authorize            (validates request, hands off to SPA)   │
│   • /oauth2/authorize/decision   (consent API: session cookie + Origin)  │
│   • /oauth2/token                (code exchange, refresh rotation)       │
│   • /oauth2/revoke               (RFC 7009)                              │
│   • /oauth2/register             (RFC 7591 DCR, policy-gated)            │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Validation module (src/phoenix/server/oauth2_authorization_server.py)  │
│   ════════════════════════════════════════════════════════════════════   │
│   • PKCE verifier grammar + S256 challenge (constant-time compare)       │
│   • Redirect URI classifier (loopback / private-use scheme / https)      │
│   • Resource-identifier canonicalization (RFC 8707)                      │
│   • Public origin resolution (PHOENIX_ROOT_URL, root-path aware)         │
│   • Pure functions — unit-testable without a server                      │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Existing token infrastructure (reused, not replaced)                   │
│   ════════════════════════════════════════════════════                   │
│   • Same access/refresh token pair as web sessions                       │
│   • Opaque jti-only JWTs; all claims live server-side in JwtStore        │
│   • Revocation = row delete + cache evict (no new revocation machinery)  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Phoenix's pre-existing OAuth2 **relying-party** routes (sign-in via external
IdPs) live under `/oauth2/{idp_name}/login` and `/oauth2/{idp_name}/tokens`.
The authorization-server endpoints share the `/oauth2` prefix with fixed path
segments, so at startup the server rejects any configured IdP whose name would
collide: `authorize`, `token`, `revoke`, `register`, and `consent` are
reserved (`app.py`, `_RESERVED_OAUTH2_IDP_NAMES`).

### The Flow

```mermaid
sequenceDiagram
    autonumber
    participant CLI as CLI / agent
    participant Browser
    participant Phoenix as Phoenix server

    CLI->>CLI: Generate PKCE pair and state,<br/>bind ephemeral loopback listener
    CLI->>Browser: Open authorize URL
    Browser->>Phoenix: GET /oauth2/authorize<br/>(client_id, redirect_uri, code_challenge, state, resource)
    opt No session cookie
        Phoenix-->>Browser: 302 to /login?returnUrl=...
        Browser->>Phoenix: Log in, resume the authorize request
    end
    Phoenix-->>Browser: 302 to /oauth2/consent<br/>(SPA shows client name, first-party badge, approve / deny)
    Browser->>Phoenix: POST /oauth2/authorize/decision<br/>(session cookie + strict Origin check)
    Phoenix-->>Browser: { redirect_to: redirect_uri?code=...&state=... }
    Browser->>CLI: Follow redirect_to to the loopback listener
    CLI->>CLI: Verify state, extract code
    CLI->>Phoenix: POST /oauth2/token<br/>(grant_type=authorization_code, code,<br/>code_verifier, client_id, redirect_uri)
    Phoenix->>Phoenix: Verify code hash, PKCE, client and redirect match,<br/>create oauth2_grants row, delete the code
    Phoenix-->>CLI: { access_token, refresh_token, expires_in }
    CLI->>CLI: Store tokens in the active profile
```

After the grant exists, the token pair cycles independently of the browser:

```mermaid
sequenceDiagram
    participant CLI as CLI / agent
    participant Phoenix as Phoenix server

    note over CLI,Phoenix: Refresh (rotation)
    CLI->>Phoenix: POST /oauth2/token<br/>(grant_type=refresh_token, refresh_token, client_id)
    Phoenix->>Phoenix: Check grant is not revoked or expired
    Phoenix-->>CLI: New access + refresh pair
    Phoenix->>Phoenix: Revoke the old refresh token<br/>and its access tokens

    note over CLI,Phoenix: Revocation
    CLI->>Phoenix: POST /oauth2/revoke (either token of the pair)
    Phoenix->>Phoenix: Revoke both tokens and mark the grant revoked
    Phoenix-->>CLI: 200 (always, per RFC 7009)
```

The consent handoff is split in two: `GET /oauth2/authorize` performs protocol
validation server-side and redirects to the SPA consent route with the request
parameters plus server-derived `client_name` and `is_first_party` display
parameters. The SPA posts the user's decision to a JSON endpoint that
re-validates the client and redirect URI and requires both a valid session
cookie and a same-origin `Origin` header (CSRF defense; dial-off via
`PHOENIX_OAUTH2_CONSENT_ORIGIN_CHECK=off` for unusual proxy setups). The
authorization code is minted only after an authenticated, origin-verified
approval. The display parameters in the SPA URL are not authenticated state:
direct navigation can forge the consent-page label or badge even though it
cannot bypass decision validation. Replacing this handoff with server-derived
display data or trusted short-lived request state remains security work.

---

## Data Model

One migration (`132d988c5bef`) adds three tables and extends the two existing
token tables. All JSON columns are JSONB on PostgreSQL.

### `oauth2_clients`

| Column | Type | Purpose |
|--------|------|---------|
| `client_id` | string, unique index | Public client identifier (`phoenix-cli`, or `px_dcr_` + 22 base62 chars for DCR) |
| `name` | string | Display name shown on the consent page |
| `logo_uri` | string, nullable | Optional client-supplied logo |
| `redirect_uris` | JSON | Every registered redirect URI; authorization is always bound to this per-client list |
| `grant_types` | JSON | Subset of `authorization_code`, `refresh_token` |
| `token_endpoint_auth_method` | string | `none` — public clients only in this iteration |
| `is_first_party` | bool | Seeded Phoenix clients get verified consent copy; DCR clients get a caution notice |
| `metadata_` | JSON, nullable | Unrecognized RFC 7591 fields, verbatim and unvalidated — client-supplied data only |
| `registration_client_ip` | string, nullable, indexed with `created_at` | Address Phoenix observed at registration. NULL for seeded clients. Held in its own column, not in `metadata_`, so a request body cannot forge it; the per-IP registration limit counts against this index rather than scanning and filtering JSON |

The `phoenix-cli` first-party client is seeded idempotently at startup
(`facilitator.py`) with `http://127.0.0.1/callback`. Loopback comparison ignores
only the port, so a CLI can bind a random port without allowing another host or
path. Startup also reconciles rows created by earlier builds of this unreleased
feature that seeded an empty redirect list.

### `oauth2_grants`

The durable record of "user U approved client C" — created at code
*redemption*, not at consent, so an abandoned browser approval leaves no
grant behind (the unredeemed code expires and is swept).

| Column | Type | Purpose |
|--------|------|---------|
| `user_id`, `oauth2_client_id` | FK, CASCADE | Grant identity |
| `scopes`, `audience` | JSON, nullable | Granted values copied onto every token; scopes are currently empty, and audience carries the canonical resource indicator when the authorization request named one (the deployment origin or the MCP endpoint) |
| `expires_at` | timestamp, nullable | Grant ceiling (default 90 days); both access- and refresh-token lifetimes are clamped to it at mint time |
| `last_used_at` | timestamp | Touched on every refresh — feeds DCR client-cleanup and future session UI |
| `revoked_at` | timestamp, nullable | Soft revocation; refresh redemption checks it |

### `oauth2_authorization_codes`

| Column | Type | Purpose |
|--------|------|---------|
| `code_hash` | string, unique index | SHA-256 of the code — a DB leak does not yield redeemable codes |
| `redirect_uri` | string | Must be echoed exactly at the token endpoint (RFC 6749 §4.1.3) |
| `code_challenge`, `code_challenge_method` | string | PKCE (S256 only) |
| `scopes`, `resource`, `audience` | JSON/string, nullable | `resource` preserves the indicator as the client sent it; its canonical form is copied to the grant and its tokens as the audience at redemption. Scope enforcement is deferred to the authorization workstream |
| `expires_at` | timestamp | 5-minute TTL; single-use — atomically claimed on redemption, rejected-and-deleted if presented after expiry, and swept at server startup |

### Token-table extensions

`refresh_tokens` gains `oauth2_grant_id` (FK, CASCADE, indexed), `scopes`,
`audience`, and `consumed_at`; `access_tokens` gains `scopes` and `audience`.
The claims cache hydrates exclusively from these rows, so a grant-minted token
carries its snapshot through cache rebuilds and server restarts — there is no
mint-time state that exists only in memory. Web-session logins leave all of
these NULL, which is how the two token populations are distinguished.

`consumed_at` is what makes replay detection possible. Rotation marks the spent
refresh row instead of deleting it, so the token remains attributable to its
grant after it stops being usable; the sweeper deletes the tombstone once the
token would have expired anyway. Every read path filters `consumed_at IS NULL`,
including the access-token join — retention would otherwise keep a rotated-away
token authenticating, and keep its paired access token alive past the rotation
that used to kill it by deleting the row out from under the join.

---

## Endpoints

| Endpoint | Method | Auth | Rate limit | Notes |
|----------|--------|------|-----------|-------|
| `/.well-known/oauth-authorization-server` | GET | none | — | RFC 8414; advertises `registration_endpoint` unless DCR is disabled |
| `/.well-known/openid-configuration` | GET | none | — | Same document at the OIDC discovery location; under a root path this is the only metadata URL in the MCP client discovery order that reaches Phoenix without proxy configuration (RFC 8414 puts the well-known segment between host and path, which the reverse proxy typically does not route) |
| `/.well-known/oauth-protected-resource` | GET | none | — | RFC 9728; lists this deployment as its own authorization server when auth is enabled |
| `/.well-known/oauth-protected-resource/mcp` | GET | none | — | RFC 9728 path-inserted metadata for the MCP endpoint: `resource` is `<origin>/mcp` rather than the deployment origin; 404 when the MCP server is not mounted |
| `/.well-known/{doc}<root path>` | GET | none | — | Path-inserted aliases (RFC 8414 §3 / RFC 9728 §3.1), registered only under `PHOENIX_HOST_ROOT_PATH`: the well-known segment goes between host and path, so these live at the host root and require the reverse proxy to forward `/.well-known/*` to Phoenix unmodified |
| `/oauth2/authorize` | GET | session cookie (redirects to login) | — | Validates client, redirect URI, state (≥22 chars), `response_type=code`, PKCE S256, optional `resource`; unsupported response types return `unsupported_response_type`; errors that can be delivered safely go to the redirect URI per RFC 6749 §4.1.2.1, pre-validation failures render an HTML error |
| `/oauth2/consent` | GET (SPA route) | session | — | Display only; owns no protocol state |
| `/oauth2/authorize/decision` | POST | session cookie + strict Origin | — | JSON body; approval mints the hashed one-time code |
| `/oauth2/token` | POST (form) | none (public clients, PKCE is the proof) | 0.2 req/s per IP | `authorization_code` and `refresh_token` grants |
| `/oauth2/revoke` | POST (form) | none | 0.2 req/s per IP | RFC 7009: always 200, even for unknown tokens |
| `/oauth2/register` | POST (JSON) | none | 10/hour per IP (default) | RFC 7591, policy-gated |

Error responses from the token endpoint are deliberately non-oracular: an
unknown code, an expired code, a client mismatch, a redirect mismatch, and a
failed PKCE check all return the same `invalid_grant`. The one distinct error
is `invalid_target` (RFC 8707) for a `resource` value that does not match this
deployment — that is a request-shape error the client needs to correct, and
it reveals nothing about any stored code.

Successful token responses and OAuth JSON error/registration responses include
`Cache-Control: no-store` and `Pragma: no-cache`. Code redemption validates
client identity, exact redirect binding, expiry, and PKCE before consuming the
code. The validated code is then deleted with a conditional `DELETE …
RETURNING` in the grant-creation transaction; PostgreSQL row locking and an
immediate SQLite write transaction ensure concurrent redemptions have one
winner. Failed validation does not consume an otherwise valid code.

---

## Redirect URI Model

The single most interop-sensitive design surface. Agent platforms redirect in
three structurally different ways, and each class gets its own validation rule
(RFC 8252 is the guiding document for the first two):

| Class | Validation | Who needs it |
|-------|-----------|--------------|
| **Loopback** (`http://127.0.0.1`, `::1`, `localhost`) | Must match a URI registered to that client by scheme, host, path, and query; only the port may differ; fragments and userinfo are rejected | CLIs and desktop agents bind an ephemeral port per login. Different clients register the path they actually use — `/`, `/callback`, `/callback/<id>`, or `/mcp/oauth/callback` — while RFC 8252 §7.3 requires the AS to accept an arbitrary runtime port. |
| **Private-use scheme** (`cursor://…`, `vscode://…`) | Exact registered URI match; scheme must also be a valid URI scheme *not* in a deny-set (`http`, `https`, `javascript`, `data`, `vbscript`, `file`, `blob`, `about`, `ws`, `wss`); fragments are rejected | Desktop IDE agents whose OS routes the scheme to the installed app (Cursor's documented desktop callback is `cursor://anysphere.cursor-mcp/oauth/callback`). Exact per-client binding prevents one registered native client from borrowing another client's callback. |
| **HTTPS registered** | Exact string match against the client's registered list, plus an optional host allowlist | Hosted agent surfaces (web-based agents with a cloud callback URL). Highest-risk class — a redirect to an attacker-controlled https URL exfiltrates codes — so it is off except at the most permissive dial position. |

Classification and validation live in one pure function
(`validate_redirect_uri`) used identically at authorization time, decision
time, and DCR time, so the three checkpoints cannot drift apart.

---

## Dynamic Client Registration

### The Policy Dial

`PHOENIX_OAUTH2_DYNAMIC_CLIENT_REGISTRATION` = `disabled` | `local_only` |
**`enabled` (default)**. The dial answers two separate questions — *who may
register a client* and *where an authorization code may be delivered* — and the
delivery rule applies to every client, seeded ones included:

- **`disabled`** — no `/oauth2/register`, metadata omits
  `registration_endpoint`, and only admin-seeded clients work. Delivery falls
  back to the `local_only` classes rather than to nothing: the seeded CLI
  redirects to loopback, so refusing loopback whenever registration is off would
  leave no client able to complete a flow, including the one Phoenix seeds
  itself. Turning registration off must not turn login off.
- **`local_only`** — anyone may register, but only loopback and private-use
  redirects validate. Whatever a registrant claims, the authorization code is
  ultimately delivered to a process on the approving user's own machine or an
  app their OS resolves. This is the shape MCP-style agent platforms expect:
  they attempt DCR automatically on connecting to a new server, and a server
  without it forces every user through manual client configuration.
- **`enabled`** — additionally allows exact-registered https redirects,
  optionally constrained by `PHOENIX_OAUTH2_ALLOWED_REDIRECT_HOSTS`.

The rationale for shipping DCR on by default at `enabled`: the registration
step itself grants nothing — a registered client still cannot obtain a token
without a logged-in Phoenix user clicking approve on the consent page, the
authorization code is delivered only to the exact redirect URI the client
registered, and PKCE binds the exchange to the flow's initiator. `local_only`
was the original default on the theory that code delivery should stay on the
approving user's machine, but MCP clients in the wild broke on it immediately:
Cursor registers an HTTPS callback (`https://www.cursor.com/agents/mcp/oauth/
callback`) alongside its loopback and private-use-scheme ones, and RFC 7591
registration is all-or-nothing, so one rejected URI fails the whole
registration. A default that breaks the flagship MCP clients out of the box
buys little: the marginal exposure of `enabled` is that an approved code may
be delivered to a registered HTTPS endpoint instead of a local process, and
that delivery is still gated by the same user consent. Operators who want the
tighter posture set `local_only`, or keep `enabled` and constrain hosts with
`PHOENIX_OAUTH2_ALLOWED_REDIRECT_HOSTS`. The residual risk (a look-alike
client name on the consent page) is addressed with the first-party badge and
unverified-client caution copy.

### Registration Hygiene

Unauthenticated registration invites junk rows, and several agent platforms
re-register a fresh client on every re-authentication, so hygiene is
structural rather than optional:

- **Rate limit**: 10 registrations/hour per IP (default)
- **Unconsumed cap**: at most 50 clients per IP per day that have never been
  used in a completed grant, counted in SQL against the indexed
  `registration_client_ip` — the check runs on every registration, and
  registration spam is precisely what inflates the set being counted, so it must
  not scan the whole recent population to answer
- **Zero-grant TTL**: DCR clients that never complete a grant are deleted
  after 7 days
- **Dead-grant TTL**: DCR clients whose grants are all revoked/expired are
  deleted 30 days after the last grant went inactive
- Cleanup runs opportunistically at registration time, at most once per day
- Only `client_name` (≤200 printable chars), `logo_uri` (≤2048), redirect
  URIs, and the supported grant/response types are honored; everything else is
  retained opaquely in `metadata_`. All submitted redirect URIs are stored and
  each authorization request is matched against that client's registrations.

DCR clients are always public (`token_endpoint_auth_method: none`) and
restricted to `authorization_code` + `refresh_token`.

---

## CLI Login

`px auth login` (`js/packages/phoenix-cli`) is the first-party consumer and
the reference client implementation:

1. Generates a 64-byte PKCE verifier and 32-byte state (base64url), starts an
   HTTP listener on `127.0.0.1:<ephemeral>/callback`.
2. Builds the authorize URL for `client_id=phoenix-cli` **relative to the
   configured endpoint** (root-path-safe — see Lessons Learned) and opens the
   browser; `--no-browser` prints the URL and accepts a pasted redirect URL
   instead, so the flow works over SSH.
3. Validates `state` on the callback, exchanges the code (with `verifier`) at
   `/oauth2/token`, and persists tokens into the active profile in the CLI
   settings file. A lock file serializes concurrent settings writes.
4. Subsequent commands transparently refresh when a token is within 60 s of
   expiry; rotation-aware — the settings lock is held across
   read-latest → refresh → persist so concurrent CLI processes don't race a
   rotated refresh token.
5. `px auth logout` revokes the refresh token via `/oauth2/revoke` (which ends
   the whole grant) before clearing local state; `px auth status` reports the
   authenticated user.

The overall UX target: a coding agent (or a human) runs one command, approves
once in the browser, and every subsequent CLI invocation authenticates
silently until the grant expires or is revoked.

---

## MCP as a Protected Resource

Phoenix mounts a minimal MCP server on the FastAPI app and treats it as a
second protected resource, distinct from the deployment origin. The server
(`src/phoenix/server/mcp_server.py`) advertises no tools — `initialize` and
`tools/list` succeed with an empty list — because its purpose is the
authentication chain: it is the resource an MCP client discovers, registers
for, obtains consent for, and finally connects to with a minted bearer token.
Tool surfaces can be layered on later without touching any of the plumbing
below. `PHOENIX_ENABLE_MCP_SERVER` (default `true`) controls the mount; the
dependency cost is the `server` extra of `fastmcp-slim`, whose client half was
already in the tree via `pydantic-ai`.

### The connection sequence

An MCP client given `<origin>/mcp` walks this chain, defined by the MCP
authorization specification (revision 2025-06-18) and the RFCs it composes:

1. It calls the endpoint with no credentials and receives **401** with a
   `WWW-Authenticate` header naming the protected-resource metadata URL.
2. It fetches that **PRM document** (RFC 9728) and learns the resource
   identifier and the authorization server — this same deployment.
3. It fetches the **authorization-server metadata** (RFC 8414, or the OIDC
   discovery location) and learns the authorize, token, and registration
   endpoint URLs.
4. It **registers** via DCR, opens the user's browser for **consent**, and
   exchanges the code at the token endpoint, sending `resource=<origin>/mcp`
   (RFC 8707).
5. It reconnects with the bearer token over streamable HTTP: JSON-RPC
   requests as POSTs plus a long-lived `text/event-stream` response.

Steps 3 and 4 are the machinery of the rest of this document. The
MCP-specific work is steps 1, 2, and 5: the mount, the challenge, the
per-resource metadata, and the CORS posture that lets browser-hosted clients
walk the chain at all. The chain was validated end to end against the MCP
Inspector, Cursor, and Claude Code on a root-path deployment; unit coverage
lives in `tests/unit/server/test_app_mcp_mount.py`,
`test_well_known_path_inserted.py`, and `test_anonymous_cors.py`.

### Mount-path normalization

Starlette's `Mount("/mcp")` matches `/mcp/...` but not `/mcp` itself, and the
bare path is exactly the URL an MCP client is configured with; what falls
through lands in the SPA catch-all (index.html for GET, 405 for POST — both
Cursor and the Inspector surfaced this as a 405 before the fix). A pure-ASGI
`MountPathNormalizer` rewrites the bare mount path to the mount root before
routing. Two details matter. It *rewrites* rather than redirects, preserving
single-request semantics for clients that do not follow redirects. And it
compares against the root-path-prefixed form, because a deployment behind
`PHOENIX_HOST_ROOT_PATH=/phoenix` sees `/phoenix/mcp` in the scope path — the
literal comparison never matched and the normalizer silently did nothing,
another instance of the root-path pitfalls in Lessons Learned.

### The 401 challenge

Phoenix enforces authentication on `/v1` through a FastAPI router dependency,
which a mounted ASGI app never passes through. Without a guard, an
unauthenticated `initialize` succeeds and the failure surfaces only later as
opaque tool errors, so the client never learns it should run the OAuth flow.
A `BearerAuthGuard` wraps the mounted app, delegating to the same
`is_authenticated` used by the `/v1` routers; on failure it answers 401 with:

```
WWW-Authenticate: Bearer realm="Arize Phoenix",
    resource_metadata="<origin>/.well-known/oauth-protected-resource/mcp"
```

The metadata URL is built from `public_origin` and the same module constant
the PRM route is registered under, so the challenge and the document it names
cannot drift apart.

### The per-resource PRM document

`/.well-known/oauth-protected-resource/mcp` (the RFC 9728 path-inserted form)
describes the MCP endpoint: its `resource` is `<origin>/mcp`, not the
deployment origin. It answers 404 when the MCP server is not mounted — there
is no such resource to describe — and its `authorization_servers` list is
empty when the authorization server is disabled, so discovery never points at
endpoints that refuse to answer. Under a root path, a host-root alias
(`/.well-known/oauth-protected-resource<root path>/mcp`) is registered as
well, for SDKs that derive the metadata URL from the resource URL per RFC
9728 §3.1 instead of honoring the challenge URL verbatim; like the other
path-inserted aliases, it is reachable only if the reverse proxy forwards
host-root `/.well-known/*` to Phoenix unmodified.

### A second resource identifier

Resource-indicator validation accepts the canonicalized `<origin>/mcp`
whenever the mount is enabled, alongside the deployment origin
(`_resource_mismatch`). Spec-following MCP clients send the URL they connect
to as the RFC 8707 indicator, and the indicator is persisted and bound
through the whole redemption chain — see the Resource Indicators design
decision below.

### CORS and exposed headers

The MCP endpoint joins the anonymous wildcard-CORS set described under Design
Decisions: browser-based MCP clients call it directly with a bearer token,
which is not an ambient credential, so answering any origin is the same
decision already made for the token and registration endpoints. The MCP
surface additionally exposes two response headers
(`Access-Control-Expose-Headers`) that the OAuth endpoints do not need:
`Mcp-Session-Id`, which a browser client must read to continue its
streamable-HTTP session, and `WWW-Authenticate`, which it must read from the
401 to bootstrap the OAuth flow at all. Both are invisible to cross-origin
JavaScript unless listed, even on a CORS-approved response.

---

## Design Decisions

### Reuse the existing token pair; add no new token format

Grant-minted tokens are ordinary Phoenix access/refresh tokens: opaque JWTs
whose payload is a token id, with all claims hydrated server-side from the
database. This bought revocation, expiry, cache behavior, and every existing
auth middleware for free, and means one hardening effort covers both web
sessions and OAuth2 grants. The alternative — self-contained JWTs with
embedded claims — was rejected because Phoenix's claim cache rebuilds from
rows, so any claim not derivable from a row silently vanishes on rebuild, and
because self-contained tokens cannot be revoked without reintroducing exactly
the server-side state they were meant to avoid.

### Grant at redemption, not at consent

Consent mints only a short-lived hashed code. The `oauth2_grants` row is
created inside the token exchange, in the same transaction that deletes the
code. Abandoned approvals therefore leave nothing to clean up but an expired
code row, and every grant row corresponds to a client that actually holds
tokens.

### Hashed, single-use, short-lived codes

Codes are 32 bytes of `secrets` entropy, stored as SHA-256 (lookup by hash —
inherently timing-safe on the hot path), expire in 5 minutes, and are deleted
by a conditional database claim on first valid redemption. Invalid client,
redirect, or PKCE input cannot burn a valid code, and concurrent valid
redemptions cannot both create grants. PKCE comparison uses
`hmac.compare_digest`. S256 is the only accepted challenge method; `plain` is
not implemented.

### Refresh rotation with replay detection

Redeeming a refresh token mints a new pair and revokes the old refresh token
*and every access token minted under it*.

Both tokens are clamped to the grant's remaining life at mint time, on the
initial code exchange and on every rotation. Nothing sweeps a grant when it
reaches `expires_at` — the ceiling is only consulted when a token is redeemed —
so a token minted to outlive its grant would go on authenticating past the
ceiling, because its bearer never has to come back to have it checked. Clamping
is what makes the ceiling a deadline rather than a question asked at redemption.

Rotation spends the old token by stamping `consumed_at` rather than deleting the
row. Presenting a spent token afterwards means two parties held it: whoever
redeemed it first now holds the replacement, and whoever is presenting it now
does not. Nothing in the request says which of the two is the legitimate client,
so guessing is not an option — Phoenix revokes the entire token family, which is
the grant: `revoked_at` is stamped and every refresh and access token under the
grant is deleted. This is the RFC 9700 §4.14.2 requirement for public clients,
and it is what makes theft *cost* the thief something; rejecting only the
replayed token would leave a thief who redeems first holding a live credential
while the honest client silently re-authenticates.

The signal is the tombstone, not the absence of a row. An unknown token, an
expired-and-swept one, or a web-session token that belongs to no grant leaves no
tombstone and is rejected with `invalid_grant` without touching any grant —
otherwise anyone able to POST garbage to the token endpoint could revoke other
users' sessions.

The cost is the false positive RFC 9700 accepts: a client that crashes after the
server rotated but before it persisted the new pair will retry with the spent
token and lose its grant, forcing a re-login. `consumed_at` is also what would
make the standard mitigation (a brief grace window that re-issues the same pair)
implementable later; deleting the row forecloses it.

### Revocation ends the session as a unit

`/oauth2/revoke` accepts either token of a pair; revoking one revokes both and
marks the grant revoked. Per RFC 7009 the endpoint returns 200 regardless, so
it cannot be used to probe token validity.

### Required `state`, minimum entropy

RFC 6749 only RECOMMENDS `state`, but every targeted client sends it, and it
is the CSRF binding for the callback. Phoenix requires it and enforces ≥22
characters (~128 bits base64url) so a compliant-but-lazy client cannot ship
`state=1`. This is a deliberate strictness-beyond-spec choice; the failure
mode is a clear `invalid_request` at first integration, not a latent
vulnerability.

### Resource indicators, persisted and bound

`resource` (RFC 8707) is accepted at both the authorize and token endpoints
and must canonicalize to a resource this deployment serves: the deployment
origin itself, or `<origin>/mcp` when the MCP server is mounted (scheme/host
lowercased, default ports elided, root path applied); anything else is
`invalid_target`. The indicator is persisted and bound through the whole
redemption chain: the authorization code records the resource the user
approved, the grant and every token minted under it carry its canonical form
as their audience, the token request may repeat the indicator but cannot
re-target the code, and a refresh cannot re-target the grant. What remains
deferred is enforcement at the resource servers — no endpoint yet rejects a
bearer token whose audience names the other resource. The persisted claims
establish exactly what that enforcement will need, so adding it (or adding
further audiences) is additive rather than migratory.

### Issuer identity from configuration, not from Host headers

The metadata `issuer`, the PRM `resource`, and resource-indicator matching all
derive from `PHOENIX_ROOT_URL` when set (falling back to the request base
URL). Deployments behind proxies and sub-path mounts get a stable, spoof-proof
identity; discovery documents never reflect a client-controlled Host header
when the operator has configured the canonical URL.

### Public clients only, PKCE as the proof

Every current consumer is a native/CLI app that cannot keep a secret, so
`token_endpoint_auth_method` is `none` across the board and PKCE is mandatory.
Confidential-client support (client secrets, `client_credentials`) is
deliberately absent rather than half-built.

### An operator kill switch that answers 404, not silence

`PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER=false` serves operators whose policy
is API-key-only access with no interactive OAuth. The routers stay registered
and a router-level dependency answers 404, rather than skipping registration:
an unregistered path would fall through to the SPA catch-all and answer with
`index.html` and a 200, so the deployment would still appear to serve the
endpoints. The 404 is also the signal the CLI already understands — its token
exchange maps 404 to "this server does not support OAuth login; use an API
key." Disabling the flag also empties `authorization_servers` in the
protected-resource metadata and removes the OAuth2 section from `auth.md`, so
discovery never points at endpoints that refuse to answer. Previously minted
access tokens remain valid until expiry (validation is server-side against the
token store, not an endpoint), but grants can no longer be refreshed.

### Discovery fails honestly: well-known URLs never fall back to the SPA

The SPA static handler answers unknown GET paths with index.html so client-side
routes survive a page reload. For `/.well-known/` paths that behavior is
poison: discovery clients (RFC 8414/OIDC metadata, MCP clients) probe several
candidate URLs and rely on 404s to move to the next one, so a 200 with HTML
reads as a malformed discovery document and aborts the client instead. The
static handler therefore exempts `/.well-known/` from the index.html fallback
and lets the 404 through. The same reasoning motivates serving the metadata at
the OIDC discovery location: under a root path the issuer carries a path
component, RFC 8414 then places the well-known segment between host and path
(a URL the reverse proxy typically does not route to Phoenix), and the
path-appended OIDC location is the only URL in the MCP client discovery order
that reaches Phoenix without proxy configuration.

### Wildcard, non-credentialed CORS on the anonymous surfaces only

Browser-based OAuth public clients fetch the discovery documents, register, and
exchange codes from the page itself, from origins that cannot be known in
advance (the MCP Inspector, for example, is a web app on a local port). Hosted
authorization servers answer these endpoints with
``Access-Control-Allow-Origin: *``, and Phoenix does the same — the endpoints
honor no cookies, so there is no session for a hostile page to ride, and the
flow's security rests on PKCE, single-use codes, and redirect-URI binding
rather than on which origin fetched the endpoint. The wildcard applies only to
``/.well-known/*``, ``/oauth2/register``, ``/oauth2/token``,
``/oauth2/revoke``, and the MCP endpoint when it is mounted (see MCP as a
Protected Resource for the headers that surface additionally exposes); the
cookie-honoring surfaces are excluded
(``/oauth2/authorize`` is navigated to, not fetched, and the consent decision
endpoint enforces a strict Origin check), and the credentialed
``PHOENIX_ALLOWED_ORIGINS`` allowlist for the app API is untouched. Error
responses carry the header too — a browser client can only read the OAuth
error JSON if the failure response is itself CORS-approved.

### Zero new dependencies

Evaluated pulling in an OAuth server framework; the mature Python option is
sync-only and does not integrate with the async FastAPI stack. Everything
needed — SHA-256, HMAC comparison, base64url, `secrets` — is stdlib, plus the
`joserfc` and `pydantic` already shipped. The protocol surface implemented
here is small enough that a framework would mostly be indirection.

---

## Testing

Two layers, matching how the code is split:

**Unit** (`tests/unit/server/test_oauth2_authorization_server.py` and
friends): the pure validation module — PKCE grammar and verification,
per-client matching for all three redirect classes, dial-position rejection,
the private-use-scheme deny-set, state length, resource canonicalization
(ports, case, root paths, IPv6), plus grant-claims hydration. These run with
auth disabled and no server, because the functions under test take strings and
return classifications. Facilitator tests exercise first-party client seeding
and startup reconciliation on SQLite and PostgreSQL.

**Integration** (`tests/integration/auth/test_oauth2.py`): a real server
process with auth enabled, real HTTP, no mocks. A small `_OAuthPublicClient`
helper drives the flow the way an external client would — build the authorize
URL, follow the consent decision, capture the redirect, exchange the code.
Coverage is organized by concern, one class each:

| Class | Covers |
|-------|--------|
| `TestDiscovery` | Both well-known documents, registration-endpoint advertisement per dial |
| `TestAuthorizationCodeFlow` | Happy path, denial, unsupported response type, PKCE failures without code consumption, sequential reuse, and concurrent single-use |
| `TestTokenLifecycle` | Refresh rotation, replay of rotated tokens, revocation semantics |
| `TestDynamicClientRegistration` | Registration across all three dial positions, cache headers, multi-URI persistence, per-client redirect binding, port-only loopback variance, redirect-class rejection, and rate limiting |
| `TestGrantTokenAccess` | Granted tokens act with the authorizing user's permissions (scope enforcement deferred to the authorization workstream) |
| `TestAdminGrantOversight` | Admins can list and revoke grants across users; non-admins can do neither |

Separate app fixtures run the suite against the default `enabled`
configuration (plus a rate-limited variant), an `enabled` + allowlist
configuration, and `disabled`, since the dial changes both registration and
redirect validation behavior; `local_only` semantics are pinned by unit tests
on `validate_redirect_uri`.

---

## Appendix: Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER` | `true` | Master switch: when `false`, every authorization-server endpoint and the RFC 8414 document answer 404, and the PRM stops advertising an authorization server |
| `PHOENIX_ENABLE_MCP_SERVER` | `true` | Mounts the MCP server at `/mcp` and registers its per-resource PRM; when `false`, the PRM answers 404 and `<origin>/mcp` stops validating as a resource indicator |
| `PHOENIX_OAUTH2_DYNAMIC_CLIENT_REGISTRATION` | `enabled` | The policy dial: `disabled` \| `local_only` \| `enabled` |
| `PHOENIX_OAUTH2_ALLOWED_REDIRECT_HOSTS` | unset (any) | Host allowlist for https redirects when `enabled` |
| `PHOENIX_OAUTH2_GRANT_EXPIRY_DAYS` | 90 | Grant ceiling; refresh lifetimes are clamped to it |
| `PHOENIX_OAUTH2_CONSENT_ORIGIN_CHECK` | `strict` | Origin-header enforcement on the consent decision endpoint |
| `PHOENIX_OAUTH2_DCR_RATE_LIMIT_PER_HOUR` | 10 | Per-IP registration rate |
| `PHOENIX_ROOT_URL` | unset | Canonical public URL: issuer, PRM resource, resource-indicator matching |

Access- and refresh-token lifetimes reuse the existing
`PHOENIX_ACCESS_TOKEN_EXPIRY_MINUTES` / `PHOENIX_REFRESH_TOKEN_EXPIRY_MINUTES`
configuration — grant tokens are the same tokens.

## Appendix: Standards Compliance

| Standard | Status |
|----------|--------|
| RFC 6749 (OAuth 2.0) | Authorization-code grant only; no implicit, password, or client-credentials grants |
| RFC 7636 (PKCE) | Required for all clients; S256 only |
| RFC 7009 (Revocation) | Implemented; always-200; `token_type_hint` accepted and ignored (both types are resolved) |
| RFC 7591 (DCR) | Implemented behind the policy dial; unrecognized metadata preserved |
| RFC 8414 (AS Metadata) | Implemented at the well-known path under the deployment root |
| RFC 8252 (OAuth for Native Apps) | Loopback (§7.3, arbitrary ports) and private-use schemes (§7.2) per the redirect model above |
| RFC 9728 (Protected Resource Metadata) | Implemented, deployment-wide and per-resource for `/mcp`; PRM points at this deployment as its own AS |
| RFC 8707 (Resource Indicators) | Accepted and validated against this deployment's resources (origin and the mounted MCP endpoint); `invalid_target` on mismatch; the indicator is persisted and bound through code, grant, and token — audience enforcement at the resource servers remains future work |
| OAuth 2.1 (draft) | Partially aligned: code+PKCE only, no implicit grant, registered redirect matching, and refresh rotation with replay detection; scope and resource enforcement remain future work |
| Client ID Metadata Documents (draft) | Not implemented; noted as the likely successor to DCR for agent platforms as the draft and client support mature |

## Appendix: Lessons Learned

Two root-path bugs surfaced during manual testing against a deployment mounted
at a sub-path, both worth remembering because every URL-producing feature will
meet them again:

1. **`new URL("/path", base)` discards the base path.** The CLI originally
   built `new URL("/oauth2/token", endpoint)`, which maps
   `https://host/phoenix` → `https://host/oauth2/token`. All CLI OAuth URLs
   are now resolved as *relative* references against a trailing-slash
   endpoint. If a URL is meant to live under the configured endpoint, never
   construct it with a leading slash.

2. **`returnUrl` values must be mount-relative, and only the SPA can decide
   how to navigate to them.** The login redirect initially embedded the full
   request path (including the ASGI root path) in `returnUrl`; both consumers
   — the SPA router's basename and the IdP callback's redirect — re-apply the
   prefix, producing `/phoenix/phoenix/…`. The server now strips the root path
   (`strip_root_path`, the inverse of `prepend_root_path`). Separately, a
   `returnUrl` pointing at a *backend* route (like `/oauth2/authorize`) cannot
   be reached with a client-side router transition at all — the SPA now
   performs a full document load for server-owned paths
   (`isServerOwnedPath` in `routingUtils.ts`). The failure mode is deceptive:
   the address bar shows the correct URL while the router renders a no-match
   page, and a manual refresh "fixes" it.

## Appendix: Related Documents

- `internal_docs/specs/oauth2-email-attribute-path.md` — Phoenix as an OAuth2
  *client* (relying party) for IdP sign-in; shares the `/oauth2` prefix
- `internal_docs/specs/ldap-authentication.md` — the other non-password login
  path whose form participates in the `returnUrl` contract
