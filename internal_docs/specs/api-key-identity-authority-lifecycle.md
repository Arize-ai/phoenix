# API Key Identity, Authority, and Lifecycle Model

## Purpose

Phoenix exposes API-key management through REST and GraphQL. This document defines who may
issue, inspect, use, and revoke each kind of key. Equivalent operations grant the same
authority on both surfaces, even when REST and GraphQL represent a denial differently.

This is a normative policy model. Authorization is derived from independently evaluated
facts about the credential, principal, action, resource, and environment; route names and
current implementation structure are not policy inputs.

## Terminology

- **Credential:** Evidence presented to authenticate a request, such as an access token,
  user API key, SYSTEM API key, or `PHOENIX_ADMIN_SECRET`.
- **Principal:** The identity established by a credential. A principal may be a human user,
  the internal system user, or an unauthenticated caller.
- **Credential kind:** How the caller authenticated. Credential kind is independent of
  identity and role.
- **Human principal:** A human user authenticated by either a session or a user API key.
- **Human session:** A human principal authenticated by an access token rather than a user
  API key.
- **Authority:** What the principal may do. Human authority comes from current database
  role. The admin secret receives configured bootstrap authority.
- **Admin authority:** Authority held by an `ADMIN`-role human principal or the
  admin-secret principal. A policy may further restrict an operation by credential kind.
- **User API key:** A key owned by a human user. It is also called a personal key where an
  API surface uses that name.
- **System API key:** A workload key owned by the internal SYSTEM user. It does not have
  admin authority.
- **Resource class:** Whether a stored key is a user key or system key, derived from its
  owner's current database role rather than its URL or GlobalID type name.
- **Owner operation:** An action on a human principal's own user keys.
- **Administrative operation:** An action performed through admin authority, such as
  organization-wide inventory or cross-user revocation.
- **Inventory:** A cross-owner list that includes enough owner metadata to identify and
  administer a key. It never includes the bearer secret.
- **Fail closed:** Deny when the required identity, authority, resource classification, or
  environmental precondition cannot be established.

## Decision Summary

Threat-model references use `D1` through `D9` to refer to these decisions.

1. **D1 — Workload authority.** A **system API key is a non-admin workload credential**.
   It is not equivalent to `PHOENIX_ADMIN_SECRET`.
2. **D2 — System-key administration.** Only admins may create, list, or revoke system API
   keys.
3. **D3 — Workload isolation.** System API keys cannot manage credentials.
4. **D4 — Session personal self-service.** An authenticated human session, including a
   viewer session, may create, list, and revoke the user's API keys. A new key inherits the
   user's current database role and cannot increase that role's authority.
5. **D5 — API-key personal self-service.** A user API key may list and revoke its owner's
   user keys. It cannot issue a replacement on either surface. (GraphQL retained
   transitive issuance for compatibility through Phoenix 18.)
6. **D6 — User-key administration.** `ADMIN`-role human principals may inventory and revoke
   any human user's API keys. `PHOENIX_ADMIN_SECRET` has the same administrative revocation
   authority.
7. **D7 — System-key issuance.** System-key issuance requires an `ADMIN` human session or
   `PHOENIX_ADMIN_SECRET` on both surfaces; API keys cannot issue credentials. (GraphQL
   retained issuance by an `ADMIN`-role user key for compatibility through Phoenix 18.)
8. **D8 — Authentication required.** Credential management fails closed when
   authentication is disabled.
9. **D9 — Complete authorization.** Authorization checks credential kind, principal
   identity and authority, action, and resource class; no one dimension is sufficient by
   itself.

## How Decisions Are Derived

For each request, ask five separate questions:

1. **How did the caller authenticate?** Human session, user API key, SYSTEM API key, admin
   secret, or no credential.
2. **Whom does the credential represent?** A human user, the internal system user, or no
   authenticated identity.
3. **What authority does that principal have now?** Current database role, configured
   bootstrap authority, or workload authority.
4. **What action is requested?** Owner self-service, administrative management, credential
   issuance, or workload/data-plane use.
5. **What resource and environment are involved?** Key class, ownership, authentication
   mode, read-only mode, and storage state.

These dimensions must not be collapsed. In particular, a SYSTEM API key and
`PHOENIX_ADMIN_SECRET` share the internal system-user identity but have different credential
kinds and authority.

Two consistency checks catch contradictory or incomplete policies:

- **Privilege dominance:** If a principal may perform a broad destructive action but not a
  narrower one, the narrower denial needs an independent reason.
- **Threat completeness:** A mitigation must interrupt the complete attack path. Preventing
  escalation does not, by itself, prevent an attacker from preserving existing authority.

Security conflicts converge on fail-closed behavior: workload credentials are excluded
from credential management, credential classes cannot be crossed by relabeling an ID,
unauthorized revocation does not disclose key existence, and credential management fails
closed without authentication.

Product capabilities follow Phoenix's documented UX. Viewer key self-service and admin
cross-user revocation are deliberate capabilities. They do not increase a principal's
role: viewer keys remain viewer keys, and admins already hold organization-wide
control-plane authority.

## Threat Model

The design addresses the following threats. Each maps to a policy response; not every risk
can be eliminated without removing the corresponding issuance capability.

| Threat | Description | Policy response |
|---|---|---|
| Workload-to-control-plane escalation | A leaked or stolen SYSTEM-role key is used to manage credentials, users, or settings. | SYSTEM keys are workload credentials and credential-management operations deny them by default (D1, D3, D9). |
| Privilege persistence | A compromised user API key mints a same-role replacement and outlives revocation of the original. | Both surfaces deny API-key-authenticated issuance, so revoking the compromised key is effective containment for that credential (D5). Replacements minted through legacy GraphQL issuance before the Phoenix 19 upgrade may still exist; inventory the affected user's keys when the compromise predates the upgrade. |
| Issuance-origin compromise | A compromised human session or admin secret uses legitimate issuance authority to create durable credentials. | Issued keys have bounded authority and are independently inventoried and revoked. Invalidating the issuer does not by itself revoke keys already issued (D4, D5, D7). |
| Peer-credential tampering | One system credential enumerates or revokes other system credentials because all system keys share the internal system-user owner. | Ownership alone is never sufficient; system-key management requires admin authority on a SYSTEM resource (D2, D9). |
| Key-ID enumeration | Revoke or delete endpoints are probed to learn which key IDs exist. | Unauthorized, missing, and wrong-class targets return one indistinguishable denial. |
| Resource-class confusion | A client-supplied GlobalID is relabeled to cross the user/system boundary in the shared table. | Resource class is derived from the owner's database role, not the presented type name (D9). |
| Credential issuance without identity | A bearer credential is minted while authentication is disabled, outliving the current configuration. | All credential management fails closed without authentication (D8). |

## Identity and Credential Model

### Principals

| Principal | Representation | Authority |
|---|---|---|
| Human session | `PhoenixUser` authenticated by an access token | Current database role; may issue a user key |
| User-key holder | `PhoenixUser` authenticated by a user API key | Current database role; credential issuance denied |
| System-key holder | `PhoenixUser` authenticated by a SYSTEM-role API key | Non-admin workload access |
| Admin-secret principal | `PhoenixSystemUser` authenticated by `PHOENIX_ADMIN_SECRET` | Bootstrap/admin access; may issue system keys |
| Unauthenticated caller | No authenticated `PhoenixUser` | No credential-management access |

A SYSTEM-role API key and the admin-secret principal both refer to the internal system
user, but they are not equivalent. A SYSTEM-role API key becomes an ordinary `PhoenixUser`
whose `is_admin` property is false. `PHOENIX_ADMIN_SECRET` creates a
`PhoenixSystemUser` whose `is_admin` property is true.

Code and documentation use **SYSTEM-role API key** and **admin-secret principal**
explicitly; the ambiguous phrase "system user" does not imply administrator authority.

### User API Keys

A user API key is associated with a human user and acts on that user's behalf. Creation
uses the user's current database role and requires a human session on both surfaces. The
owner may list and revoke the key; an admin may inventory and revoke it as a control-plane
operation.

### System API Keys

A system API key is associated with the internal system user rather than a human. It is
intended for service-to-service and automated workloads. Admins create and revoke system
keys, but using a system key does not grant admin authority. In practice a system key has
ordinary non-viewer data-plane access—for example it can read projects and ingest traces—
but is rejected from admin-only routes such as `/v1/users`. See
`docs/phoenix/self-hosting/features/authentication.mdx` for the per-role REST access
tables.

### Control Plane and Data Plane

- **Control-plane operations** manage identities, credentials, users, and settings.
- **Data-plane operations** use Phoenix resources, such as ingesting traces or querying
  projects.

System keys are data-plane credentials. Managing system keys is a control-plane action.
New control-plane operations deny workload credentials by default and must explicitly name
every admitted credential kind.

## Authorization Principles

### Authentication does not imply authorization

Possession of a key establishes the request principal. It does not grant permission to
manage that key or related keys. Every credential-management operation authorizes the
principal, action, and resource.

### Workload identity is not administrative identity

"System" describes whom a credential represents, not how much authority it carries.
Treating every ingestion or automation credential as an administrator would turn a
data-plane secret into a control-plane secret and substantially increase the impact of a
leak.

```text
PHOENIX_ADMIN_SECRET / ADMIN user
    └── may administer system keys

SYSTEM-role API key
    └── may perform permitted workload operations
        └── may not administer keys
```

### Delegation is explicit

A credential cannot implicitly mint a durable replacement, transform itself into another
principal class, or create a credential with greater authority.

- Both surfaces deny issuance by every API key.
- A SYSTEM-role key cannot transform itself into a human-role key through a personal-key
  operation.
- A human session may create a user key as explicit delegation to a durable credential; the
  new key uses current server-side role state.
- An `ADMIN` human session or the configured admin secret may create a system key as an
  explicit control-plane operation.

Through Phoenix 18, GraphQL retained a compatibility behavior that was authority-bounded
but transitive: a compromised user key could preserve access by issuing a replacement
before revocation. Role inheritance prevented privilege escalation, but it did not contain
persistence. As of Phoenix 19, both surfaces enforce the explicit, non-transitive model:
human sessions and the admin secret are issuance origins, while API keys issued by those
origins cannot issue another key.

The admin secret is a root bootstrap authority, so compromise can create persistent
workload credentials. Rotating the secret contains future use but does not revoke
previously issued SYSTEM keys; those keys must be inventoried and revoked independently.

### Shared ownership is not sufficient authorization

Phoenix stores user and system API keys in one `api_keys` table. System keys share the
single internal system-user owner. Consequently, this check is unsafe by itself:

```text
key.user_id == caller.identity
```

For a SYSTEM principal, it would treat every system key as the caller's own. Credential
authorization therefore incorporates:

1. the caller's credential kind;
2. the caller's identity and current authority;
3. the action being requested;
4. the key owner's role, which defines the resource class; and
5. ownership or admin authority, where applicable.

URL paths, GraphQL fields, and client-supplied GlobalID type names are presentation
boundaries, not trusted resource classification.

### Revocation does not disclose existence

An `ADMIN`-role human principal or the admin-secret principal can revoke a compromised
human user's key even when the owner is unavailable. An unauthorized caller receives the
same external result as a caller naming a missing or wrong-class key. This prevents key-ID
existence probing.

### Viewer self-service is explicit

Viewer is a read-only data role, not a prohibition on self-service security operations.
Creating a viewer key preserves viewer authority, and revoking one's own key reduces risk.
REST therefore exempts personal API-key create and revoke operations from its general
viewer write restriction.

### Credential management requires authentication

Without authentication Phoenix has no authenticated principal to own or authorize a
credential. Every REST API-key route fails closed. GraphQL personal mutations have an
explicit authentication-enabled permission; admin-gated GraphQL fields fail closed through
their admin permission.

## Capability Matrix

"Own user key" refers only to a key owned by a non-SYSTEM user. The split between session and API-key credentials is intentional: role alone does not determine issuance authority.

| Operation | Session VIEWER | Session MEMBER | Session ADMIN | User key VIEWER | User key MEMBER | User key ADMIN | SYSTEM key | Admin secret | Auth disabled |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Create own user key | ✅ Allow | ✅ Allow | ✅ Allow | ❌ Deny | ❌ Deny | ❌ Deny | ❌ Deny | ❌ Deny | ❌ Deny |
| List own user keys | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | Empty¹ | Empty¹ | ❌ Deny |
| Revoke own user key | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ✅ Allow | ❌ Deny | ❌ Deny | ❌ Deny |
| List all users' keys | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| Revoke another user's key | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| Create system key | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ❌ Deny | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny |
| List system keys | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |
| Revoke system key | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ❌ Deny | ✅ Allow | ❌ Deny | ✅ Allow | ❌ Deny |

The admin-secret principal has no personal identity separate from the internal system user,
so it has no owner branch for personal-key operations. Its independently configured admin
authority nevertheless admits the administrative branches for inventory, cross-user
revocation, and system-key management. This matches Phoenix's bootstrap-admin model while
keeping a SYSTEM API key, which shares the identity but not the authority, excluded.

¹ Both surfaces return an empty collection: REST responds `200` with no keys and GraphQL
returns an empty `viewer { apiKeys }` field. A system-backed principal owns no user-class
keys, so the truthful result is an empty list rather than an error, and a client can list
personal keys through either surface interchangeably. See
[REST and GraphQL Equivalence](#rest-and-graphql-equivalence).

Deployment mode applies after the principal/resource decision:

| Mode | REST | GraphQL |
|---|---|---|
| Normal | Capability matrix applies | Capability matrix applies |
| Authentication disabled | All credential management denied | All credential management denied |
| Read-only | Entire `/v1` API disabled, including queries | Queries allowed by matrix; mutations denied |
| Storage locked | Queries and revocation allowed by matrix; issuance denied | Queries and revocation allowed by matrix; issuance denied |

Read-only mode intentionally has transport-level availability semantics: Phoenix disables
the REST API as a whole, while GraphQL continues to serve queries. Storage lock is instead
a capacity-recovery condition, so revocation remains available on both surfaces.

## Credential Classification and Ownership

API keys do not have a separate persisted kind column. Resource class is derived from the
owner's current database role:

- owner role `SYSTEM` → system API key;
- owner role `ADMIN`, `MEMBER`, or `VIEWER` → user API key.

Shared DB-backed policy functions resolve principal role and key owner role for both REST
and GraphQL. Personal owner operations require a human identity and a non-SYSTEM resource.
Administrative user-key operations require admin authority and a non-SYSTEM resource.
System-key operations require admin authority and a SYSTEM resource. Issuance additionally
checks credential kind and role: both surfaces deny issuance by every API key.

This design keeps the established lifecycle in which system credentials survive deletion
of the admin who created them. Distinct service principals per workload were considered
but not adopted because they would require new identity, attribution, migration, and
lifecycle semantics. Explicit credential and resource classification provides the needed
isolation without changing persistence.

## REST and GraphQL Equivalence

REST and GraphQL make the same authorization decision for equivalent operations:

- The same credential kind, principal, action, and resource class must produce the same
  authorization decision.
- A principal backed by the internal system user owns no user-class keys, so listing its
  personal collection returns empty on both surfaces: REST responds `200` with no keys and
  GraphQL returns an empty `viewer { apiKeys }` field. A client can therefore swap surfaces
  without handling a rejection on one and an empty list on the other. Neither surface
  exposes user keys, and the system user's own keys (which are system keys) are never
  returned here.
- Unauthorized, missing, and wrong-class revocation targets use the same non-enumerating
  external result within each surface.
- URL paths, field names, and client-supplied GlobalID type names describe presentation.
  Database ownership determines resource class.

Transport availability is separate from resource authority. In read-only mode Phoenix
intentionally disables the entire REST `/v1` API while continuing to serve GraphQL queries;
this deployment-mode boundary is not an authorization difference between equivalent
operations that are available on both surfaces.

Equivalent authority does not require identical error taxonomy:

| Scenario | REST | GraphQL | Rationale |
|---|---|---|---|
| SYSTEM key invokes personal-key mutation | `403 Forbidden` before target lookup | `NotFound` or `Unauthorized`, depending on the mutation | Categorical credential-kind denial; REST does not inspect the target and therefore leaks no target existence |
| API key invokes an issuance mutation | `403 Forbidden` | `Unauthorized` | Credential issuance starts from a session or admin-secret origin |
| Admin secret creates a personal key | `403 Forbidden` | `Unauthorized` | The internal system user has no human owner branch |
| Unauthorized cross-user revocation | `404 Not Found` | `NotFound` | Missing and unauthorized targets are intentionally indistinguishable |
| GlobalID has the wrong presentation type or malformed encoding | `422 Unprocessable Entity` | GraphQL `errors` response | Request shape is invalid before resource authorization |
| GlobalID presentation is valid but the database key has the wrong resource class | `404 Not Found` | `NotFound` | Resource classification is database-derived and non-enumerating |

Client code may depend on each surface's documented error contract, but it must not infer
different authority from these representational differences.

## Surface Enforcement

### REST

All routes require authentication to be enabled.

| Route | Policy |
|---|---|
| `GET /v1/user/api_keys` | Lists the caller's own user keys; a system-backed principal receives an empty collection |
| `POST /v1/user/api_keys` | Human session creates a key with current DB role; API keys denied |
| `DELETE /v1/user/api_keys/{id}` | Owner, `ADMIN`-role human principal, or admin-secret principal revokes a non-SYSTEM key |
| `GET /v1/users/api_keys` | Admin inventories all non-SYSTEM keys with owner metadata |
| `GET /v1/system/api_keys` | Admin lists SYSTEM keys |
| `POST /v1/system/api_keys` | `ADMIN` human session or admin-secret principal creates a SYSTEM key; API keys denied |
| `DELETE /v1/system/api_keys/{id}` | Admin revokes a SYSTEM key |

The `/v1` router applies common authentication and read-only dependencies. Ordinary
resource routers additionally apply the viewer write restriction. API-key routes are
mounted outside that nested restriction and enforce their explicit capability policy:
viewer personal self-service remains available, while organization-wide and system-key
operations remain admin-gated.

The root read-only dependency intentionally disables every `/v1` method, including list and
inventory requests. This is a transport-availability policy for the REST API, not an
API-key-specific authorization decision.

The organization-wide inventory endpoint is required to make cross-user revocation
operational: an admin must be able to discover a key's GlobalID and owner before revoking
it. Returning owner metadata also lets operators distinguish similarly named keys without
exposing the bearer secret itself.

### GraphQL

| Field | Policy |
|---|---|
| `viewer { apiKeys }` | Returns only non-SYSTEM keys owned by the viewer |
| `createUserApiKey` | Auth-enabled human session creates a key with current DB role; API keys denied |
| `deleteUserApiKey` | Auth-enabled owner or admin, including admin-secret principal; non-SYSTEM resource; non-enumerating denial |
| `userApiKeys` | Admin inventories all non-SYSTEM keys |
| `systemApiKeys` | Admin lists SYSTEM keys |
| `createSystemApiKey` | `ADMIN` human session or admin-secret principal creates a SYSTEM key; API keys denied |
| `deleteSystemApiKey` | Admin revokes a verified SYSTEM resource |

GraphQL GlobalID validation verifies the requested presentation type. Authorization also
verifies the database resource class, so relabeling a user-key row as `SystemApiKey` or a
system-key row as `UserApiKey` cannot cross the boundary.

The GraphQL personal-key list is a projection on the `viewer` object rather than a
standalone management operation. It filters out resources that are not user-class keys, so a
system-backed principal sees an empty list — the same result REST returns for the same
principal.

Personal `createUserApiKey` and `deleteUserApiKey` mutations intentionally omit
`IsNotViewer`: viewer credential self-service is allowed by D4 and D5. `createUserApiKey`
and `createSystemApiKey` deny API-key-authenticated callers with an `Unauthorized` error;
issuance starts from a session or the admin-secret principal. Administrative system-key
mutations remain admin-gated. GraphQL queries remain available in read-only mode, while
`IsNotReadOnly` denies credential issuance and revocation.

## Issuance Compatibility History

Through Phoenix 18, GraphQL permitted API-key-authenticated issuance for backward
compatibility: a user API key could create another user key for the same owner, and an
`ADMIN`-role user key could create a system key. The REST API-key endpoints, introduced
later, enforced non-transitive issuance from their first release.

Phoenix 19 removed the GraphQL compatibility behavior
([`Arize-ai/phoenix#14396`](https://github.com/Arize-ai/phoenix/issues/14396)). Both
surfaces now enforce the same policy: human sessions may issue user keys, human `ADMIN`
sessions and the admin secret may issue system keys, and delegated API keys may not issue
another credential. The GraphQL schema is unchanged; the mutations deny API-key callers
with an `Unauthorized` error. Workflows that relied on unattended key creation must
provision keys from a session-authenticated context instead; see `MIGRATION.md` for the
operator-facing guidance.

## Role Resolution and Lifecycle

New keys always use the owner's current database role. Existing API keys adopt role changes
from server-side state; runtime authorization follows the token-store refresh timing
described below.

API-key JWTs contain a token ID (`jti`), not an embedded role. `JwtStore` reconstructs
claims from database state and refreshes its in-memory cache every 10 seconds. Runtime
principal flags can therefore lag a role change until the next refresh.

Consequently, after an API-key owner is demoted from `ADMIN`, admin checks that use the
cached runtime principal may continue to admit that key until refresh. Authorization paths
that query the database directly, including credential issuance and user-key revocation,
use the new role immediately.

Credential issuance and personal-key classification query the database directly. A role
change consequently applies immediately when a human session creates a credential on
either surface, without waiting for token-store cache refresh. `PhoenixSystemUser` carries no token claims, and authorization
never relies solely on cached claims. REST may use a credential's claims for an early
fail-closed SYSTEM rejection, but permitted role-based decisions use current database
state. Credential kind is resolved from the authenticated credential itself and is not
inferred from role.

Session tokens and API keys diverge on role change. Changing a user's role logs the user
out, evicting their access and refresh tokens immediately. API keys are intentionally not
evicted: they remain valid and pick up the new role, within the refresh interval for
runtime flags and immediately when issuing a new credential because issuance queries
current database role. This keeps long-lived workload credentials stable across
administrative changes while still binding their authority to current server-side role
state.

In read-only mode the entire REST API is unavailable, while GraphQL permits queries and
blocks mutations. Under storage lock, both surfaces block creation but leave queries and
revocation available.

## Credential Lifecycle and Secret Handling

An API key follows this state model:

```text
issued → active → inactive
                    ├── expired
                    └── revoked
                        ├── direct revocation
                        └── owner deleted
```

- **Issued.** The server generates the bearer secret, persists only the information needed
  to authenticate and manage it, and returns the plaintext exactly once.
- **Active.** The key authenticates as its owner with authority derived from current
  server-side state.
- **Inactive.** An expired or revoked key no longer authenticates.
- **Expired.** The key becomes inactive when its configured expiration is reached.
- **Revoked.** An authorized revocation permanently makes the key inactive and is not
  reversible.
- **Owner deleted.** Deleting a human owner revokes all of that owner's keys. System keys
  are bound to the non-deletable internal system user.

Plaintext keys must not be persisted, returned by list operations, or written to logs.
Names, descriptions, owner metadata, timestamps, and identifiers are management metadata,
not bearer secrets.

API keys cannot issue replacements on either surface, so revoking a compromised key
contains that credential. Responders should still inventory the affected user's keys when
the compromise may predate the Phoenix 19 upgrade, because legacy GraphQL issuance could
have minted replacements before enforcement began. Likewise, rotating a compromised admin
secret does not revoke SYSTEM keys created with it; those keys require separate inventory
and revocation.

Authorization is evaluated against authoritative state at the decision point. Operations
that span authorization and mutation must fail closed if the caller, owner, or target no
longer satisfies policy. Revocation is safe to repeat conceptually even when the transport
reports a missing key.

This model does not depend on audit logging for authorization correctness. Credential
issuance, administrative inventory, revocation, and admin-secret use are security-relevant
events, but audit-event retention and operational incident procedures are outside the scope
of this document.

## Invariants and Edge Cases

- **System user existence.** The data model intends exactly one user with role `SYSTEM`.
  System-key operations require at least one. If legacy or inconsistent data contains
  more than one, choosing the lowest user id prevents nondeterministic ownership; it is a
  compatibility fallback, not a supported multi-system-user model. Operators should repair
  that state.
- **Classification is derived, not stored.** A key's class comes from its owner's current
  database role, not a persisted column. Changing the internal system user's role would
  reclassify every system key with no migration; the system user's role must not be
  repurposed.
- **User deletion revokes keys.** Deleting a human user revokes that user's API keys as
  part of the deletion, so no key outlives its owner.
- **Expiration.** A key may carry a future expiration. An expired key no longer
  authenticates and is pruned by the token-store refresh.
- **Admin-secret principal.** The admin-secret principal's identity is the internal system
  user; it has no personal keys, but its configured bootstrap authority admits
  administrative user-key and system-key operations. It is available only when the
  deployment is configured with a system user id.

## Conformance

The capability matrix must be enforced with real bearer credentials across REST and
GraphQL. Coverage must include:

- session-based viewer create/list/revoke self-service;
- REST and GraphQL rejection of credential issuance by every API-key credential kind,
  including an `ADMIN`-role user key invoking system-key issuance;
- admin-secret system-key issuance with personal-key issuance denied;
- owner revocation through a user key;
- admin organization-wide inventory and cross-user revocation, including the admin secret;
- identical missing/unauthorized revocation denial;
- empty personal lists and mutation denial for SYSTEM-key principals;
- viewer personal self-service on both REST and GraphQL;
- rejection of personal/system GlobalID relabeling;
- distinct presentation-validation and resource-class denial;
- immediate DB-role use after a role change;
- auth-disabled fail-closed behavior;
- complete REST `/v1` denial in read-only mode;
- GraphQL query availability with mutation denial in read-only mode;
- storage-lock query and revocation availability with issuance denial.

Primary conformance suites:

- `tests/integration/auth/test_api_keys.py`
- `tests/integration/auth/test_auth.py`
- `tests/integration/server/test_launch_app.py`
- `tests/unit/server/api/routers/v1/test_api_keys.py`
- `tests/unit/server/api/helpers/test_api_key_policy.py`

The REST route registry in `tests/integration/_helpers.py` separately records common reads,
admin-only operations, viewer-blocked writes, viewer credential self-service, and routes
that require authentication to be enabled.

## Implementation References

- `src/phoenix/server/api/helpers/api_key_policy.py`
- `src/phoenix/server/api/routers/v1/api_keys.py`
- `src/phoenix/server/api/routers/v1/__init__.py`
- `src/phoenix/server/api/mutations/api_key_mutations.py`
- `src/phoenix/server/api/types/User.py`
- `src/phoenix/server/api/queries.py`
- `src/phoenix/server/api/auth.py`
- `src/phoenix/server/authorization.py`
- `src/phoenix/server/bearer_auth.py`
- `src/phoenix/server/jwt_store.py`
