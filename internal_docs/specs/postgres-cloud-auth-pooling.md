# PostgreSQL Cloud Authentication and Connection Pooling

This is a reference for developers working with Azure Database for PostgreSQL (with Microsoft Entra / managed-identity authentication) and AWS RDS for PostgreSQL (with IAM authentication). It covers how cloud-issued access tokens flow through the PostgreSQL protocol, how the relevant SDKs handle token acquisition, and how SQLAlchemy's connection pool interacts with all of it.

The motivating question is simple: *if my access token expires every N minutes, what do I have to do to keep my database connections working?* The answer depends on a few interacting layers — the PostgreSQL wire protocol, the cloud SDK's token cache, and SQLAlchemy's pool — and a few of the natural assumptions about how those layers interact turn out not to hold. This document spells out the actual behavior of each layer so the right knobs end up in the right places the first time.

Every non-trivial claim cites a primary source. Inferences and unverified claims are explicitly marked.

## Key facts at a glance

1. **PostgreSQL authenticates clients exactly once, during the connection startup handshake.** It never re-validates credentials for the life of the session. This is a property of the PostgreSQL wire protocol and applies to vanilla PostgreSQL, Azure Database for PostgreSQL, and AWS RDS for PostgreSQL alike.
2. **An existing PostgreSQL connection survives the expiry of the access token that authenticated it.** Both Microsoft and AWS document this explicitly. Token expiry only constrains *opening new connections*, not the lifetime of established sessions.
3. **`pool_recycle` aligned to "token lifetime" is therefore not load-bearing for correctness.** Its only legitimate role is connection-age hygiene. Aligning it tightly to the token window churns connections for no benefit.
4. **`azure-identity` for Python caches tokens in memory by default** for `ManagedIdentityCredential` and the other cloud-hosted credentials. Application-level caching of Azure tokens is therefore usually unnecessary.
5. **AWS RDS IAM token generation is purely local** — `boto3.generate_db_auth_token()` is a SigV4 signing operation, not a network call. Per-connection token generation is microseconds and needs no caching layer at all.
6. **SQLAlchemy `pool_pre_ping`** runs the dialect's `do_ping` (a `SELECT 1` for the asyncpg/PG dialect) on each pool checkout, but skips the ping for newly-created connections. With `NullPool` the ping never runs at all because every checkout creates a new connection.

The rest of this document expands each of these with citations.

## PostgreSQL protocol authentication semantics

PostgreSQL authenticates clients exactly once, during the startup-message exchange that opens a connection. There is no protocol mechanism for re-validating credentials mid-session.

> "To begin a session, a frontend opens a connection to the server and sends a startup message. […] The server then sends an appropriate authentication request message, to which the frontend must reply with an appropriate authentication response message (such as a password). For all authentication methods except GSSAPI, SSPI and SASL, there is at most one request and one response. […] Once the frontend has received AuthenticationOk, the connection enters the normal query handling phase."
>
> — [PostgreSQL Documentation, 54.2 Message Flow](https://www.postgresql.org/docs/current/protocol-flow.html)

Everything else in this document follows from this single fact. It applies equally to vanilla PostgreSQL, Azure Database for PostgreSQL, and AWS RDS for PostgreSQL — all three implement the same PostgreSQL wire protocol on the server side, regardless of how the credential is generated on the client side. Cloud-issued tokens are just passwords from the server's perspective; the server checks them once during the startup handshake and never references them again.

## Azure Database for PostgreSQL with managed identity

### End-to-end flow

When a client running on Azure (e.g. an App Service, AKS pod, or VM with system-assigned managed identity) wants to connect to Azure Database for PostgreSQL using Entra authentication:

1. The client asks `azure-identity` for an access token scoped to `https://ossrdbms-aad.database.windows.net/.default`. In Python this is typically `DefaultAzureCredential().get_token(scope)`.
2. `azure-identity` resolves the credential chain. In a deployed Azure environment this typically lands on `ManagedIdentityCredential`, which makes an HTTP request to the Azure Instance Metadata Service (IMDS) at `http://169.254.169.254/metadata/identity/oauth2/token`.
3. IMDS returns an `AccessToken` containing a JWT and an `expires_on` Unix timestamp. The SDK caches it in memory.
4. The client opens a PostgreSQL connection (e.g. `asyncpg.connect(...)`) using the JWT as the password parameter. The PG server validates the JWT against Microsoft Entra during the startup handshake.
5. From that point on, the connection is a normal PostgreSQL session. The token is never referenced again.

### Token lifetimes

Microsoft's official documentation distinguishes two token classes for the Azure PostgreSQL scope:

> "User tokens are valid for up to 1 hour. Tokens for system-assigned managed identities are valid for up to 24 hours."
>
> — [Microsoft Entra Authentication for Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-azure-ad-authentication)

The often-cited "60 minutes" figure applies to the user-token path. Server-side and AKS workloads using system-assigned managed identity get tokens with up to **24-hour validity**. The documented upper bounds are 1 hour (user tokens) and 24 hours (system-assigned managed-identity tokens).

For managed-identity service principals, Microsoft Entra configurable token-lifetime policies are **not supported**, so managed-identity token lifetime should be treated as service-controlled:

> "Configuring token lifetimes for managed identity service principals isn't supported."
>
> — [Configurable token lifetimes in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes)

### Server behavior on token expiry

Microsoft's official product docs and protocol semantics together indicate that token validity is enforced at sign-in/connection-open time, not as a periodic re-check on already-established sessions:

> "The deleted Microsoft Entra user can still sign in until the token expires (up to 60 minutes from token issuing)."
>
> — [Microsoft Entra Authentication for Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-azure-ad-authentication)

Additionally, Microsoft support guidance for Flexible Server states there is no built-in parameter to terminate sessions when access tokens expire (see the linked Microsoft Q&A thread in Sources).

The quote above is from the perspective of revoking a user — the relevant detail is that the only thing standing between revocation and continued access is "until the token expires," confirming that the token matters at the *moment of new sign-in*. Existing sessions persist regardless.

### Token caching in azure-identity for Python

`azure-identity` performs in-memory token caching by default for `ManagedIdentityCredential` (both sync and async variants) and most other cloud-hosted credentials. Application code calling `get_token` repeatedly will receive the cached token until it nears expiry, at which point the SDK refreshes it transparently.

> "Token caching is a feature provided by the Azure Identity library that allows apps to: cache tokens in memory (default) or on disk (opt-in). […] In-memory caching is activated by default."
>
> — [azure-identity Python README — Token caching](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#token-caching)

The TOKEN_CACHING.md document for the version pinned in `uv.lock` explicitly lists `ManagedIdentityCredential` among the credentials that cache tokens in memory by default:

> "The following credentials support in-memory token caching: AuthorizationCodeCredential, AzurePipelinesCredential, ClientAssertionCredential, CertificateCredential, ClientSecretCredential, DeviceCodeCredential, EnvironmentCredential, InteractiveBrowserCredential, **ManagedIdentityCredential**, OnBehalfOfCredential, WorkloadIdentityCredential."
>
> — [azure-identity TOKEN_CACHING.md (1.25.1)](https://github.com/Azure/azure-sdk-for-python/blob/azure-identity_1.25.1/sdk/identity/azure-identity/TOKEN_CACHING.md)

The bug fix that made `ManagedIdentityCredential` cache tokens correctly landed in `1.6.0b3` (April 2021). The credential was re-implemented on top of MSAL in `1.18.0b1` (July 2024):

> "1.6.0b3 (2021-04-06): ManagedIdentityCredential caches tokens correctly."
>
> "1.18.0b1 (2024-07-16): The synchronous ManagedIdentityCredential was updated to use MSAL for handling most of the underlying managed identity implementations."
>
> — [azure-identity CHANGELOG.md](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/identity/azure-identity/CHANGELOG.md)

Phoenix pins `azure-identity >= 1.18.0` in `pyproject.toml` (the floor this document verified by source-reading; see the section below). The current `uv.lock` resolves to `1.25.3`. Any code on a modern `azure-identity` can call `credential.get_token(scope)` once per new connection and trust the SDK to deduplicate the underlying IMDS round-trips.

#### How the async cache is wired (verified by reading the installed source)

The async `ManagedIdentityCredential` is not a separate implementation — it shares the cache machinery with the sync version through a common base class. The chain (in azure-identity 1.25.3 as installed under Phoenix's venv) is:

1. `azure.identity.aio._credentials.managed_identity.ManagedIdentityCredential` is a thin wrapper that picks a concrete inner credential based on environment variables. In a typical AKS/VM deployment with no special envs set, it constructs `ImdsCredential` (line 112).
2. `azure.identity.aio._credentials.imds.ImdsCredential` inherits from `GetTokenMixin` and implements two abstract methods: `_acquire_token_silently` returns `self._client.get_cached_token(*scopes, **kwargs)` (line 68), and `_request_token` actually hits the IMDS HTTP endpoint (line 89).
3. `azure.identity.aio._internal.get_token_mixin.GetTokenMixin._get_token_base` is the public `get_token` workflow. It first calls `_acquire_token_silently` to check the cache (line 122), then calls `get_refresh_status(token, self._last_request_time)` (line 125), and only invokes `_request_token` if the status is `REQUIRED` (lines 126-130) or `RECOMMENDED` (lines 131-138). For `RECOMMENDED`, refresh failures are silently swallowed and the cached token is kept.
4. `azure.identity._internal.managed_identity_client.ManagedIdentityClientBase` is the shared base class for the sync and async managed-identity clients. It constructs `self._cache = TokenCache()` from MSAL by default (line 37), calls `self._cache.add(...)` after every successful token fetch (line 89), and `get_cached_token` searches the MSAL `TokenCache` for an unexpired token honoring both `expires_on` and `refresh_on` (lines 96-120).

The async `AsyncManagedIdentityClient` extends `ManagedIdentityClientBase` (no overrides for cache management), so the cache instance, the cache lookup logic, and the cache-then-refresh control flow are all literally the same code as the sync path.

The same five files were also read for `azure-identity == 1.18.0` (the first stable that uses MSAL for managed identity). The structure is identical: `ImdsCredential` is the same class with the same cache lookup, `AsyncManagedIdentityClient` extends the same `ManagedIdentityClientBase`, the base class instantiates `msal.TokenCache()` in its constructor, `_process_response` adds to the cache after every successful fetch, and `get_cached_token` honors both `expires_on` and `refresh_on`. The only differences are stylistic refinements added between 1.18.0 and 1.25.3: the refresh-decision helper was renamed from `_should_refresh()` returning `bool` to `get_refresh_status()` returning an enum, and `_acquire_token_silently` started forwarding kwargs to support claims-based cache skipping. Neither changes the core "cache hit → maybe refresh, fall back gracefully on failure" semantics.

**Conclusion: the async `DefaultAzureCredential().get_token()` for managed identity caches tokens identically to the sync version, and this has been true since at least `azure-identity == 1.18.0`.** An application that calls it on every new database connection will, after the first call, receive the cached token instance until the SDK decides a refresh is needed — at which point the SDK handles the refresh transparently and falls back to the still-valid cached token if the refresh attempt fails. There is no behavior an application-level cache can add on top of this that the SDK isn't already doing.

If application code chooses to delete its own token-cache wrapper and rely on this SDK behavior, the safe minimum version pin is **`azure-identity >= 1.18.0`** — that is the version this document verified by reading source. Earlier versions may also work (the original cache fix landed in `1.6.0b3`, April 2021) but were not source-verified for this document.

### IMDS server-side caching and rate limits

Independently of the SDK-level cache, the Azure Instance Metadata Service that serves managed-identity tokens does its own server-side caching and enforces rate limits:

> "The back-end services for managed identities maintain a cache per resource URI for around 24 hours."
>
> — [Microsoft Learn: Use managed identities on a virtual machine to acquire access token](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-use-vm-token)

> "Requests to the Managed Identity category are limited to 20 requests per second and 5 concurrent requests on a per VM basis."
>
> — [Azure Instance Metadata Service for virtual machines](https://learn.microsoft.com/en-us/azure/virtual-machines/instance-metadata-service)

The 20-RPS / 5-concurrent ceiling matters if you somehow defeat the SDK cache and call IMDS for every connection in a hot loop. With the SDK cache present (which it is by default), application code does not approach this limit under normal use.

### Implementation pattern

For a new Azure-managed-identity codebase, the minimum viable implementation is:

```python
from azure.identity.aio import DefaultAzureCredential

credential = DefaultAzureCredential()  # construct once, reuse for the process

async def open_connection() -> asyncpg.Connection:
    token = await credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
    return await asyncpg.connect(
        host=host, port=port, user=user, password=token.token,
        database=database, ssl="require",
    )
```

That is sufficient. The SDK caches the token in memory across calls, IMDS caches server-side, the resulting JWT is only consumed at handshake, and any pooled connections built from this creator survive the token's expiration.

The credential should be reused across calls because constructing a `DefaultAzureCredential` is non-trivial (it probes every credential source in its chain), so it is normally treated as a process-lifetime singleton.

## AWS RDS for PostgreSQL with IAM authentication

### End-to-end flow

When a client wants to connect to AWS RDS for PostgreSQL using IAM authentication:

1. The client asks boto3 to generate an authentication token via `boto3.client("rds").generate_db_auth_token(DBHostname=..., Port=..., DBUsername=...)`. This is a **local SigV4 signing operation on the client side** — boto3 builds and signs a presigned URL using the AWS credentials already loaded in the process. The signing computation is HMAC-SHA256 over a canonical representation of the request bytes; no HTTP traffic happens inside this specific function call (verified by reading `botocore/signers.py:559` in the installed package, which calls `_request_signer.generate_presigned_url(...)` and returns the URL directly). The AWS credentials themselves were typically loaded earlier from a host-local metadata service (EC2 IMDSv2, ECS task metadata, or the EKS pod identity endpoint) and are cached in the boto3 `Session`; the credential-bootstrap path is invisible from this call site in steady state. See the comparison section below for how this lines up with the Azure flow.
2. The client opens a PostgreSQL connection using the resulting token as the password parameter. RDS validates the SigV4 signature during the startup handshake. This validation is **not** local to RDS: the SigV4 model is symmetric (HMAC), and RDS does not hold customer secret keys, so the verification goes through AWS's internal IAM machinery to recompute and compare the signature, then check that the IAM principal has the `rds-db:connect` permission on the requested DB user resource. The cost of this round-trip is paid by RDS, not by the application, and is not visible from the client.
3. From that point on, the connection is a normal PostgreSQL session. The token is never referenced again.

### Token lifetime and connection persistence

AWS documentation is unambiguous that RDS IAM tokens matter only at authentication time:

> "After you generate an authentication token, it's valid for 15 minutes before it expires. If you try to connect using an expired token, the connection request is denied."
>
> — [AWS RDS User Guide: Connecting to your DB instance using IAM authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Connecting.html)

> "The token is only used for authentication and doesn't affect the session after it is established."
>
> — [AWS RDS User Guide: IAM database authentication for MariaDB, MySQL, and PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)

The 15-minute window is exclusively a constraint on *opening* a new connection. A token signed at T=0 cannot be used to open a new connection at T+16min — it must be regenerated. But any session that successfully completed its handshake within the 15-minute window survives indefinitely after the token expires.

### Why no per-token caching is needed at the application level

Because `generate_db_auth_token` performs only a local HMAC computation against credentials that boto3 has already cached (no HTTP traffic in this specific function call, see the end-to-end flow above), there is no per-call latency cost worth caching away. Each call is microseconds — equivalent in order of magnitude to computing a hash over a few hundred bytes. An application-level cache wrapping `generate_db_auth_token` would add complexity and a stale-token failure mode without measurable benefit.

A separate caching layer does exist further down the stack: the AWS credentials that `generate_db_auth_token` uses for signing are themselves cached in the boto3 `Session` after being fetched from a host-local metadata service, and refreshed in the background before they expire. That caching is provided by botocore and is not something application code needs to reproduce.

The natural pattern is therefore to call `generate_db_auth_token` fresh every time a new connection is opened. The token is brand new at that moment, the asyncpg handshake takes well under the 15-minute validity window, and the token never sits idle in memory waiting to expire.

### Security model

Because the token is just a SigV4-presigned URL, the security properties are inherited from SigV4 plus a few RDS-specific bindings. In summary:

- **Signature proves possession of the AWS credentials.** SigV4 is HMAC-SHA256 keyed by a value derived from the AWS secret access key. The secret key never leaves the client; RDS verifies the signature through AWS's internal IAM machinery.
- **The signature is bound to a specific resource.** It commits to the hostname, port, AWS region, action (`connect`), and DB username. A token signed for `alice@db1.region-A` cannot be replayed against `bob@db2.region-B`, or even against `bob@db1.region-A`.
- **The signature is time-bounded.** The 15-minute `X-Amz-Expires` window in the presigned URL limits how long a stolen token is usable for opening *new* connections. (As established above, it has no bearing on already-established sessions.)
- **TLS is required.** RDS IAM auth requires SSL/TLS on the connection — without TLS, the presigned URL would be observable in transit and an on-path attacker could replay it within the 15-minute window. The `ssl="require"` parameter in the implementation pattern below enforces this.
- **IAM permission boundary.** A valid signature is necessary but not sufficient: the IAM principal must also hold the `rds-db:connect` permission on the specific DB user resource. Signing a valid token does not by itself grant any access; IAM authorization is checked separately.

Token caching is not a security-relevant choice in this model. A cached token is reusable for the duration of its 15-minute window from any process holding it — the same in-memory exposure profile as any password-equivalent secret. The reason no caching layer is used is the cost argument above, not security; if anything, regenerating per connection minimizes the in-memory exposure window.

### Implementation pattern

For a new AWS RDS IAM codebase, the minimum viable implementation is:

```python
import asyncpg
import boto3

rds_client = boto3.client("rds")  # construct once, reuse for the process

async def open_connection() -> asyncpg.Connection:
    token = rds_client.generate_db_auth_token(
        DBHostname=host, Port=port, DBUsername=user,
    )
    return await asyncpg.connect(
        host=host, port=port, user=user, password=token,
        database=database, ssl="require",
    )
```

That is sufficient. No token cache, no validity tracking, no expiry buffer — every new connection gets a freshly-signed token at the moment of the handshake.

## How AWS and Azure compare

It is tempting to read the two sections above as describing fundamentally different architectures — Azure has to "fetch a token from IMDS" while AWS "generates locally." That framing is correct in narrow technical detail but misleading at the architectural level. Both clouds bootstrap their credentials from a host-local metadata service; they just cache different things at different layers.

### The architectural difference: bearer tokens vs signing keys

The two clouds use different credential models:

**Azure managed identity is bearer-token-based.** The thing your application presents to a resource (Azure DB for PostgreSQL, Storage, Key Vault, etc.) *is* the credential — a JWT signed by Microsoft Entra, scoped to a specific resource (the `https://ossrdbms-aad.database.windows.net/.default` scope, in our case). Your application does not hold any cryptographic material to derive this token from; the token has to be issued to you by the Azure infrastructure. IMDS at `169.254.169.254` is the host-local trust boundary that lets your VM/AKS pod say "I am the managed identity assigned to this resource" and get back a JWT that proves it.

**AWS IAM is HMAC-signing-key-based.** The thing your application *holds* is an AWS access key ID + secret access key (+ optionally a session token). These are not presented directly to AWS services — instead, you use them to compute a SigV4 signature over each individual request you want to make. The secret key never leaves the client; only the per-request signature does. RDS verifies the signature by recomputing it via AWS's internal IAM service (see the AWS section's "End-to-end flow" step 2 for citations).

The asymmetry between "Azure makes a network call to get the token" and "AWS does the equivalent locally" is really an asymmetry between "Azure caches a *token* you present" and "AWS caches a *signing key* you sign with."

### AWS also has a metadata-service call

An EC2 instance, ECS task, or EKS pod running with an IAM role does not have AWS credentials baked into it at launch time. When boto3 starts up, it resolves credentials through a chain that, in those environments, ends with a call to a host-local metadata service (EC2 IMDSv2 at the same `169.254.169.254` address Azure happens to use, or the equivalent endpoint for ECS/EKS). That call returns temporary AWS credentials with a typical session lifetime measured in hours. boto3 caches these credentials in the `Session` and refreshes them in the background before they expire.

So the per-connection picture in steady state is:

| | AWS RDS IAM | Azure managed identity |
|---|---|---|
| Network call to a host-local metadata service | Yes — at boto3 session bootstrap, to fetch the AWS credentials | Yes — at first `get_token()`, to fetch the JWT |
| What the metadata call returns | Temporary AWS signing keys (typically multi-hour lifetime) | A bearer token scoped to one resource (up to 24 h for system-assigned MI) |
| What you can do locally with the cached object | Sign arbitrarily many SigV4 requests for any AWS service | Present the same JWT to any resource that accepts that scope, until the JWT expires |
| Cost per *new connection* with cache warm | Local HMAC signing only (microseconds) | Cached-JWT lookup only (no I/O) |
| When the SDK refreshes from metadata | Background refresh of the credentials before the multi-hour window closes | Cache eviction at near-expiry, then a fresh IMDS call on the next `get_token` |

In steady state, **neither cloud makes a network call per connection**. Both amortize the metadata-service round-trip across many connection openings via SDK-level caching that is invisible from application code.

### Why the AWS API *feels* synchronous and Azure does not

Three reasons that have less to do with architecture than with where the SDK boundaries fall:

1. **The boto3 credential refresh happens off the call path of `generate_db_auth_token`.** When you call `generate_db_auth_token(...)`, you don't see any network activity because the boto3 `Session` already has fresh credentials cached from an earlier (or background) refresh. If the credentials were cold or expired, boto3 would block on a refresh inside that call — but in steady state it doesn't. `azure-identity`'s `get_token` is structurally similar: with a warm cache it returns immediately and feels purely local; with a cold cache it blocks on an IMDS call.
2. **AWS exposes a signing primitive; Azure exposes a token primitive.** SigV4 lets user code hold the secret key and produce per-request signatures locally, so the SDK boundary is "give me a signed string." Azure deliberately does not expose the analogous primitive — the JWT is the only thing user code ever sees, and the JWT is what `get_token` returns. Microsoft chose to keep all the cryptographic material behind the IMDS boundary so user code never handles key material directly. This is a smaller-attack-surface trade-off, not an architectural necessity.
3. **Per-request signatures vs reusable tokens make the lifecycle feel different.** SigV4 produces a fresh signature for each call, so it is natural to call it "local computation." Azure's `get_token` produces a reusable token, so it is natural to call it "fetching." Both descriptions are accurate, but they emphasize different parts of the same overall lifecycle.

### What the symmetry means for application code

The consequences for code that uses either cloud are:

- **Both cloud SDKs already do the right caching** — boto3 caches the AWS credentials (refreshed before expiry), and azure-identity caches the JWT (refreshed near expiry, with graceful fallback on refresh failure; see the verified source-reading section above).
- **Application code does not need its own caching layer in either case.** For AWS, the per-call signing cost is microseconds. For Azure, the per-call cache lookup cost is also microseconds. Adding an application-level wrapper around either function adds complexity without measurable benefit.
- **`pool_recycle` is unrelated to either cloud's token mechanics.** It controls connection age in the SQLAlchemy pool, not token freshness — see the next section.

## Connection pooling with cloud auth

When you put SQLAlchemy's connection pool in front of a cloud-auth creator like the ones above, two pool settings deserve attention: `pool_recycle` and `pool_pre_ping`. A common pattern is to align `pool_recycle` to the token lifetime, on the assumption that pooled connections will fail once their original token expires. They will not — see the protocol section above. This section walks through what each knob actually does so the right defaults are easy to choose.

### `pool_pre_ping`

When `pool_pre_ping=True`, SQLAlchemy invokes the dialect's `do_ping` implementation on each pool checkout to verify the connection is still alive. For the asyncpg/PG dialect, `do_ping` is inherited from `DefaultDialect` and is a `cursor.execute(SELECT 1)` round-trip:

```python
def do_ping(self, dbapi_connection: DBAPIConnection) -> bool:
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute(self._dialect_specific_select_one)
    finally:
        cursor.close()
    return True
```

— `sqlalchemy/engine/default.py:750-756` in the version Phoenix installs

If the ping fails (network reset, server-side connection drop, etc.), SQLAlchemy invalidates the connection, opens a fresh one via the creator, and hands the new connection to the caller. The check runs **once per pool checkout** — i.e. once per `engine.begin()` or `async with AsyncSession() as session` block — not once per executed statement.

The ping is **explicitly skipped** for connections that were just created. In `sqlalchemy/pool/base.py`, `_ConnectionRecord.fresh` is set to `True` immediately after `_invoke_creator` builds a new DBAPI connection (line 898), and the pool's checkout path tests `if not connection_is_fresh` before running the ping (lines 1302-1303):

```python
if pool._pre_ping:
    if not connection_is_fresh:
        ...  # do the ping
```

This means a brand-new connection — the kind a creator produces — never pays the ping cost on its first checkout.

`pool_pre_ping` is the right tool for catching:

- Idle-timeout drops by upstream load balancers, NAT gateways, or PgBouncer.
- Server-side failovers and maintenance restarts.
- DBA-initiated session terminations.
- Transient TCP resets.

### `pool_recycle`

`pool_recycle=N` tells SQLAlchemy to discard any pooled connection older than N seconds when it is checked out, and open a fresh one in its place. It is **age-based**, not liveness-based — it fires on a wall-clock cap regardless of whether the connection is still alive.

For cloud-auth pools, a common configuration is to set `pool_recycle` to "slightly less than the token lifetime" so that the pool turns over before tokens expire. Per the protocol section, this alignment is not necessary for correctness: the token only matters at handshake time, and existing sessions are unaffected by token expiry. **`pool_recycle` is a hygiene knob, not a token-validity knob.** Reasonable values are in the tens of minutes — long enough that the pool isn't churning, short enough to bound how stale any individual connection can become.

Aligning `pool_recycle` to a tight token window (e.g. 14 minutes for AWS IAM) reduces the practical benefit of pooling: every connection rotates several times an hour, paying the full TCP + TLS + PG startup cost on each rotation, and the warm-pool benefit shrinks under sustained load.

### `NullPool`

`NullPool` is a special pool implementation that opens a fresh connection on every checkout via the creator and disposes it on return — it does not retain connections at all. Combined with the "skip ping on fresh connection" behavior above, this means **`pool_pre_ping` and `pool_recycle` are no-ops on a `NullPool` engine**: the ping is skipped because every connection is fresh, and there are no long-lived connections for `pool_recycle` to age out.

`NullPool` is the right choice for short-lived auxiliary engines like a one-shot migration runner, where each connection is used briefly and discarded. For such engines, both `pool_pre_ping` and `pool_recycle` can be omitted — they have no effect there.

### Cost of `pool_pre_ping` under load

The pre-ping is one round-trip per pool checkout. Whether that cost is meaningful depends on how many checkouts your workload does per request. Application patterns that open one short transaction per database call (e.g. a GraphQL resolver that wraps each query in its own `async with session` block) pay the ping per call. Workloads that hold a single session for the duration of a request pay it once per request.

This cost is almost always worth paying. The alternative — letting the first query on a silently-dropped connection raise a `ConnectionResetError` to the caller — is worse than a sub-second ping in any user-facing system.

## Common assumptions and what is actually true

Several intuitive assumptions about how cloud-auth tokens interact with PostgreSQL and pooling do not hold under the protocol semantics covered above. The table below lists the most frequent ones alongside the corresponding behavior.

| Assumption | What actually happens |
|---|---|
| "When the access token expires, my pooled connections will start failing." | The token is only checked at the handshake. Existing connections survive the token's expiry indefinitely. |
| "I need `pool_recycle` < token lifetime to keep my pool valid." | `pool_recycle` does not refresh tokens — it just opens new connections. Existing connections do not need a new token. A useful `pool_recycle` is a hygiene cap, unrelated to the token window. |
| "I need to write my own token cache so I don't fetch a token on every connection." | For Azure: `azure-identity` (sync and async) already caches in memory by default through MSAL's `TokenCache`, verified by source reading. For AWS: token generation is a local SigV4 signing operation, microseconds per call, so caching adds complexity without measurable benefit. |
| "I should set the `pool_recycle` value to whatever the token lifetime is." | Token lifetime and pool hygiene are orthogonal concerns. Pick `pool_recycle` based on how long an individual connection should be allowed to age, not based on token expiry. |
| "If the IAM/MI token has 14 minutes left when I open a connection, the connection will only live for 14 minutes." | The connection lives for as long as the underlying TCP session survives, regardless of any token in its history. |
| "AWS RDS will close my session when its IAM token expires." | AWS documents in three independent places that token expiry does not affect established sessions. |
| "I need a refresh buffer of several minutes on my Azure token cache to handle retries." | The refresh-retry argument does not apply because (a) the SDK cache handles refresh transparently and (b) a code-level cache that does not fall back to the old token on refresh failure gains nothing from a wider buffer. |

## Event-loop affinity of `azure.identity.aio` credentials

`azure.identity.aio.DefaultAzureCredential` (and the inner `ManagedIdentityCredential` / `ImdsCredential` it resolves to in Azure-hosted environments) is an async-transport credential: on first `get_token(scope)` it lazily constructs an `AsyncPipeline` built around an `azure.core.pipeline.transport.AioHttpTransport`, which in turn opens an `aiohttp.ClientSession`. `aiohttp.ClientSession` is bound to **whichever event loop was running when it was created** — reusing it from a different loop (including a loop that has since been closed) raises `RuntimeError: Event loop is closed` at the first await inside the session.

Constructing `DefaultAzureCredential()` itself does not bind to a loop. The binding happens at the first `await credential.get_token(...)`, when the pipeline is instantiated. So a credential built in sync context (before any loop exists) is fine — until some loop calls `get_token` on it and thereby pins the credential's transport to that loop.

This matters for any application that runs one short-lived `asyncio.run(...)` (e.g. a migration runner) and then later runs a long-lived loop (e.g. a web server) while sharing the same credential instance between them. The sequence is:

1. Main thread/process builds one `DefaultAzureCredential` in sync context. No loop is bound yet.
2. Short-lived loop A starts (typically via `asyncio.run` inside a worker thread for one-shot work), calls `credential.get_token(scope)`, and the credential's aiohttp session is lazily created and bound to loop A.
3. Loop A finishes its work and is closed by `asyncio.run`'s cleanup.
4. Long-lived loop B starts. Application code calls `credential.get_token(scope)` on the same credential. The credential reuses its cached aiohttp session, which is still bound to the (now closed) loop A. The next network read/write inside the session raises `RuntimeError: Event loop is closed`.

The `ManagedIdentityCredential` / `ImdsCredential` MSAL `TokenCache` described earlier in this document is orthogonal to this issue. The `TokenCache` lives on the `ManagedIdentityClientBase` instance and stores the *token bytes*; the aiohttp `ClientSession` lives on the pipeline inside the credential and is what has loop affinity. A warm `TokenCache` hit will still traverse the pipeline's transport layer on every call — see `GetTokenMixin._get_token_base` in `azure/identity/aio/_internal/get_token_mixin.py`, which routes even cache-hit-only calls through the async pipeline — so "the token is cached" does not exempt the call from touching a potentially dead aiohttp session.

### Symptom: `RuntimeError: Event loop is closed` on pool connection-open in Phoenix

The shape of this bug in any Phoenix-like setup: one `DefaultAzureCredential` instance is shared — via a single async-creator closure — between a migration engine and a primary engine. The migration engine runs via [src/phoenix/db/migrate.py](src/phoenix/db/migrate.py)'s `migrate_in_thread` → `asyncio.run(run())` in a worker thread, which creates and then closes a fresh loop for the duration of the migration. When the first migration checkout fires the creator, the credential's aiohttp session is bound to that throwaway loop. When migrations finish, `asyncio.run` closes the loop and returns, but the credential — held alive by the closure, which is held alive by the primary engine — persists.

Later, uvicorn starts the long-lived server loop and the primary pool opens its first real connection. The creator calls `credential.get_token(scope)`, azure-identity routes the call through the cached pipeline, the pipeline hands it to the aiohttp session bound to the dead migration loop, and the call raises `RuntimeError: Event loop is closed`. Because this surfaces inside SQLAlchemy's pool-open path, it looks like a pool error rather than a credential error.

The `TokenCache`-level cache cannot short-circuit the failure because the cache lookup still traverses the async pipeline on every `get_token` call (see the paragraph above).

### Why this does not bite the AWS path

[src/phoenix/db/aws_auth.py](src/phoenix/db/aws_auth.py) opens a *fresh* `session.client("rds")` async context inside `async_creator` for every connection. `aioboto3.Session()` itself is a configuration object with no aiohttp state, and each `session.client(...)` builds a new botocore event-loop-bound client stack for the duration of that `async with` block. The long-lived object the AWS closure captures (`aioboto3.Session`) has no event-loop affinity; the per-loop-affine thing (the aiohttp client stack inside the RDS client) is created and torn down inside each call, so it always lives and dies on the currently running loop. The AWS path therefore composes correctly with `asyncio.run`-based migration runners without any extra care.

### Fix

[src/phoenix/db/azure_auth.py](src/phoenix/db/azure_auth.py) exposes a single high-level entry point, `create_azure_engine(url, connect_args, **engine_kwargs) -> AsyncEngine`, which builds its own `DefaultAzureCredential`, wires the async creator into `sqlalchemy.ext.asyncio.create_async_engine`, and monkey-patches the returned engine's `dispose` method (instance-level, not class-level) so that `await engine.dispose()` also `await`s `credential.close()`. The credential, the creator, and the dispose hook are all private to the closure — callers only see an `AsyncEngine`. [src/phoenix/db/aws_auth.py](src/phoenix/db/aws_auth.py) exposes an analogous `create_aws_engine` with the same shape, minus the dispose patch (aioboto3 has no loop-affine state to clean up).

[src/phoenix/db/engines.py](src/phoenix/db/engines.py) calls `create_azure_engine` **twice** in the `use_azure` branch of `aio_postgresql_engine` — once for the primary engine, once for the migration engine — so each engine owns its own `DefaultAzureCredential` instance. The migration engine's credential binds to the throwaway `asyncio.run(...)` loop inside `migrate_in_thread`, and `migrate.py`'s existing `await engine.dispose()` call (run inside that same loop, before `asyncio.run` tears it down) closes the credential on the loop that owns its aiohttp session. The primary engine's credential binds cleanly to uvicorn's loop on first use and is closed via the existing `shutdown_callbacks.append(primary_engine.dispose)` wiring in [src/phoenix/server/cli/commands/serve.py](src/phoenix/server/cli/commands/serve.py). The AWS branch also calls `create_aws_engine` twice for symmetry, though one session could safely be reused across both engines.

The dispose monkey-patch is instance-level (`engine.__dict__`, shadowing the class method via normal attribute lookup), not class-level. It assumes SQLAlchemy always invokes `dispose` via `engine.dispose(...)` rather than `type(engine).dispose(engine)`, which is true in the versions Phoenix pins; any future SQLAlchemy change that invoked it via the class would silently bypass the patch and leak the credential.

The alternative considered was a lazy, loop-keyed credential inside `async_creator` that would rebuild the credential whenever `asyncio.get_running_loop()` differed from the cached one. That approach is self-healing for arbitrary future callers under new loops, but has no clean way to close the migration-loop credential — by the time the creator notices the loop has changed, the migration loop is already dead and `await credential.close()` is no longer possible. It would produce a one-shot `Unclosed client session` warning on stderr per process start, which is the kind of noise that later masks a real bug. The two-credential approach closes both credentials cleanly on their respective loops and was preferred for that reason.

## Phoenix implementation notes

The Phoenix codebase implements both auth paths in:

- [src/phoenix/db/azure_auth.py](src/phoenix/db/azure_auth.py) — `create_azure_engine(url, connect_args, **engine_kwargs)` builds a fully-configured `AsyncEngine` authenticated via Azure managed identity. Each call creates a fresh `DefaultAzureCredential`, wires the async creator into SQLAlchemy, and patches `engine.dispose` so teardown also closes the underlying credential on whatever loop `dispose` is awaited on. The credential never escapes the closure. See "Event-loop affinity of `azure.identity.aio` credentials" above for why the credential must not be naively shared across the migration loop and the server loop.
- [src/phoenix/db/aws_auth.py](src/phoenix/db/aws_auth.py) — `create_aws_engine(url, connect_args, **engine_kwargs)` builds a fully-configured `AsyncEngine` authenticated via AWS RDS IAM. Generates a fresh token per connection, no cache layer. This matches the recommended pattern. No dispose patch needed: aioboto3's per-call `session.client("rds")` context creates and tears down its aiohttp stack on each connection, so nothing loop-affine survives across calls.
- [src/phoenix/db/engines.py](src/phoenix/db/engines.py) — wires both cloud-engine factories plus the plain-password branch. Uses `pool_pre_ping=True` on every non-migration branch. `pool_recycle` uses `_POOL_RECYCLE_SECONDS` (55 minutes) for managed-identity, AWS IAM, and static-password branches. Migration engines use `NullPool` and omit both knobs. The `use_azure` branch calls `create_azure_engine` twice (once for the primary engine, once for the migration engine) so each engine gets its own credential bound to the loop that will end up using it.

## Open questions and unverified claims

These are things this document deliberately does not assert as fact:

1. **AWS RDS auth plugin internals.** This document asserts only the *behavioral* claim that existing IAM-authenticated sessions survive token expiry. It does not assert anything about how RDS implements IAM auth on the server side (whether there is an `rdsauthproxy` component, whether the verification is in-process or sidecar, etc.) because none of the cited sources verify those details and they are not load-bearing for the conclusions here.
2. **Exact intra-region latency numbers.** Statements like "Azure intra-region latency is 1–3 ms" or "asyncpg handshake is sub-second" are intuition, not measurements. They should not be cited in code comments without a benchmark.

## Sources

PostgreSQL:

- [PostgreSQL Documentation, 54.2 Message Flow](https://www.postgresql.org/docs/current/protocol-flow.html)
- [PostgreSQL Documentation, 20.5 Password Authentication](https://www.postgresql.org/docs/current/auth-password.html)

Azure:

- [Microsoft Entra Authentication for Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-azure-ad-authentication)
- [Configurable token lifetimes in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes)
- [Microsoft Q&A: Automating session termination for expired access tokens in Azure PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/answers/questions/2242405/automating-session-termination-for-expired-access)
- [Microsoft Learn: Use managed identities on a virtual machine to acquire access token](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-use-vm-token)
- [Azure Instance Metadata Service for virtual machines](https://learn.microsoft.com/en-us/azure/virtual-machines/instance-metadata-service)
- [azure-identity Python README — Token caching](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#token-caching)
- [azure-identity TOKEN_CACHING.md (1.25.1)](https://github.com/Azure/azure-sdk-for-python/blob/azure-identity_1.25.1/sdk/identity/azure-identity/TOKEN_CACHING.md)
- [azure-identity CHANGELOG.md](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/identity/azure-identity/CHANGELOG.md)
- [Enable token caching in azure-identity (Issue #26177)](https://github.com/Azure/azure-sdk-for-python/issues/26177)

AWS:

- [AWS RDS User Guide: Connecting to your DB instance using IAM authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Connecting.html)
- [AWS RDS User Guide: IAM database authentication for MariaDB, MySQL, and PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)
- [AWS Signature Version 4 for API requests](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html)
- [Elements of an AWS API request signature](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-signing-elements.html)
- [generate-db-auth-token — AWS CLI Command Reference](https://docs.aws.amazon.com/cli/latest/reference/rds/generate-db-auth-token.html)
- `botocore/signers.py:515-566` — `generate_db_auth_token` source (read directly from `.venv/lib/python3.10/site-packages/botocore/signers.py`).

SQLAlchemy:

- `sqlalchemy/pool/base.py` and `sqlalchemy/engine/default.py` in the installed package at `.venv/lib/python3.10/site-packages/sqlalchemy/` (read directly, not via web docs).

azure-identity source files (read directly from `.venv/lib/python3.10/site-packages/azure/identity/`):

- `aio/_credentials/managed_identity.py` — async `ManagedIdentityCredential` wrapper that selects an inner credential per environment.
- `aio/_credentials/imds.py` — async `ImdsCredential` implementing `_acquire_token_silently` (cache lookup) and `_request_token` (IMDS HTTP call).
- `aio/_internal/get_token_mixin.py` — `GetTokenMixin._get_token_base`, the cache-then-refresh control flow shared by all async credentials.
- `aio/_internal/managed_identity_client.py` — `AsyncManagedIdentityClient`, which extends the shared sync/async base.
- `_internal/managed_identity_client.py` — `ManagedIdentityClientBase`, which owns the MSAL `TokenCache` and implements `get_cached_token` and `_process_response` (the cache-add path).
