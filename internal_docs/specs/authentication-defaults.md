# Authentication defaults without a configured secret

Require authentication for network listeners without mandatory secret configuration.
Preserve local convenience and durable keys. Token authentication, stored credential
confidentiality, and initial admin ownership have separate requirements.

## Authentication policy

`PHOENIX_HOST` defaults to `127.0.0.1`. When `PHOENIX_ENABLE_AUTH` is unset,
authentication follows the bind address:

| Configuration | Authentication |
|---|---|
| Explicit `PHOENIX_ENABLE_AUTH=true` | On |
| Explicit `PHOENIX_ENABLE_AUTH=false` | Off |
| Unset; loopback bind | Off |
| Unset; non-loopback or unrecognized host | On |

Canonicalize addresses before classification, including abbreviated IPv4 and IPv4-mapped
loopback. Docker binds `0.0.0.0`, so containers require login by default. `PHOENIX_HOST`
controls HTTP, gRPC, and Prometheus; remove `phoenix serve --host` to keep bind and auth
decisions on one configuration path.

Always requiring authentication adds setup to notebooks and local quickstarts. A
container-only default leaves directly launched network servers exposed. Bind-based
defaults cover both launch paths.

Local processes can reach loopback; proxies and tunnels can expose it externally.
Operators must secure forwarding paths or explicitly enable authentication. Prometheus
remains unauthenticated when enabled. TLS, database writes, and server compromise are
outside this design's threat model.

## Durable token authentication

Create a random 32-byte seed atomically in the singleton `deployment_secret` row. Without
`PHOENIX_SECRET`, derive the signing key with HKDF and a token-specific label. Replicas
and restores share the database's seed. Fail closed until startup installs the key.

Every new token contains a 256-bit random claim, `phx_rnd`; store the complete JWT's
SHA-256 hash in its row. Acceptance checks the signature, stored claims, and matching
hash. Seed-derived signing rejects hashless rows. Request guards enforce expiration
independently of background cleanup.

A database reader knows the signing key but cannot reconstruct a token from its hash.
The random claim prevents forgery from a known record ID. This assumes the attacker has
neither a bearer token nor database write access.

With `PHOENIX_SECRET`, retain its signing key and accept legacy hashless rows after
signature verification, preserving existing sessions and API keys. New tokens still
receive random claims and hashes.

### Alternatives considered

| Key source | Reason not selected as the default |
|---|---|
| Memory | Restarts invalidate tokens; replicas disagree. |
| Local file | Requires durable storage, shared replica mounts, and separate backups. SQLite volume copies can include both data and key. |
| Fixed public signing key plus hashes | Makes hash validation the only barrier to remote forgery; also cannot protect captured redacted responses. |
| Required operator secret or external key service | Requires operator or platform setup. |

The seed aligns key lifetime with data lifetime without separate persistence obligations.
Purpose-specific HKDF labels separate keys. Retaining JWTs preserves the wire format and
token lifecycle.

## Stored credentials and browser redaction

Provider keys, workspace secrets, and GitHub tokens retain PBKDF2/Fernet encryption.
Without `PHOENIX_SECRET`, the key is publicly known and anyone with a database copy can
decrypt them. Credential forms warn about this and recommend configuring the secret.

A database-resident encryption key accompanies database copies and requires migrating
existing ciphertext. A key file adds durability and replica coordination requirements.
Refusing storage adds playground setup and breaks existing deployments. Keep the compatible
scheme with an explicit confidentiality limit; operators supply `PHOENIX_SECRET` for
database-copy protection.

Browser redaction derives a separate HKDF key from the seed and configured secret, if
present. Captured responses stay confidential without those inputs; database readers can
decrypt them when the secret is absent.

SSO replaces signed state with random state matched against an HttpOnly cookie, retaining
nonce and configured PKCE checks. An unsigned context cookie carries an absolute HTTP(S)
origin and a return path checked to be relative after decoding. SSO needs no configured
secret.

## Initial admin ownership: deferred

Initial credentials are `admin@localhost` / `admin` unless
`PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD` is configured. Valid login with `admin` while a
local account requires reset returns HTTP 403 and a reset token. In that state, resetting
to `admin` returns HTTP 422 without changing credentials or consuming the token. A
different password completes the reset.

Any reachable caller knowing the public credentials can claim the account. Operator-only
bootstrap is intentionally deferred. Deployments needing that boundary must configure an
unpredictable initial password before startup.

## Compatibility and accepted costs

These defaults target a major release. See MIGRATION.md for operator
configuration changes.

- Network deployments require ingestion credentials. Exporters without a key receive
  HTTP 401 or gRPC `UNAUTHENTICATED`; operators provision keys before switching clients.
- Restarts and restores preserve keys when the database and configured secret are retained.
- Setting, changing, or removing `PHOENIX_SECRET` changes signing and storage keys.
  Existing tokens become invalid, and credentials encrypted under the previous key must
  be entered again. Automatic re-encryption is outside this change.
- Redaction changes invalidate values fetched before upgrading. Forms can fail during
  mixed-version rollouts or when opened beforehand; refresh them after the rollout.
  Stored credentials remain intact with the same secret. Accept this transient disruption
  to avoid another derivation path or staged wire-format transition for upgrade compatibility.
