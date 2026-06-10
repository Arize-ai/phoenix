# Declarative RBAC

## Executive Summary

Phoenix currently has four role names baked into the backend and frontend:
`SYSTEM`, `ADMIN`, `MEMBER`, and `VIEWER`. Those roles are stored in
`user_roles`, but the effective permissions are not stored with the role. They
are encoded in code paths such as `PhoenixUser.is_admin`,
`PhoenixUser.is_viewer`, `IsAdmin`, `IsNotViewer`, `require_admin`, and frontend
checks against `viewer.role.name`.

This spec proposes evolving roles into declarative RBAC:

- Phoenix owns a curated ACL catalog with stable permission keys.
- A role stores a selected set of ACL grants from that catalog.
- Each user still has exactly one role.
- Built-in roles remain seeded and non-deletable, but their permissions are
  represented through the same ACL machinery as custom roles.
- Authorization checks move from role-name checks to ACL checks.

The MVP is global RBAC only. It does not introduce project-, dataset-, prompt-,
or experiment-level scoped roles.

---

## Goals

- Allow administrators to create custom roles such as "Evaluator Author",
  "Prompt Manager", or "Read-only Analyst".
- Allow administrators to assign users to those roles.
- Preserve current behavior for existing deployments after migration.
- Keep the current "one role per user" model to avoid a broad product and data
  model change.
- Make authorization checks declarative and auditable by checking named ACL
  grants instead of role names.
- Support future OIDC and LDAP group mapping to custom roles.

## Non-Goals

- Per-resource permissions such as "can edit project A but not project B".
- Multiple roles per user.
- Deny rules, negative ACLs, or precedence resolution.
- Replacing operational gates such as read-only mode or storage-lock checks.
- End-user self-service role requests.
- A public permission plugin API where deployments invent arbitrary ACL keys.
- Full audit logging beyond storing creator/updater metadata.

---

## Current State

### Data Model

Current role state lives in:

- `user_roles.name`, typed in Python as `Literal["SYSTEM", "ADMIN", "MEMBER", "VIEWER"]`
- `users.user_role_id`, with a foreign key to `user_roles.id`
- GraphQL `UserRoleInput`, which is an enum of `ADMIN`, `MEMBER`, and `VIEWER`
- Frontend `UserRole`, also an enum of `ADMIN`, `MEMBER`, and `VIEWER`

The table already gives users a role by reference, but role semantics are not in
the database.

### Authorization

Authorization is currently enforced through a small number of coarse role checks:

| Current primitive | Meaning |
| --- | --- |
| `PhoenixUser.is_admin` | `user_role == "ADMIN"` in token claims, with `PhoenixSystemUser` hard-coded as admin |
| `PhoenixUser.is_viewer` | `user_role == "VIEWER"` in token claims |
| `IsAdmin` | Requires auth enabled and admin role |
| `IsAdminIfAuthEnabled` | Allows no-auth mode, otherwise requires admin role |
| `IsNotViewer` | Allows no-auth mode, otherwise blocks viewer role |
| `require_admin` | FastAPI dependency equivalent to admin-or-system |
| `restrict_access_by_viewers` | FastAPI dependency blocking viewer mutations |

The frontend mirrors this with direct checks like `viewer.role.name === "ADMIN"`
and `viewer.role.name === "VIEWER"`.

### External Role Mapping

OIDC and LDAP currently map external claims/groups to Phoenix role names
`ADMIN`, `MEMBER`, or `VIEWER`. `SYSTEM` is intentionally not assignable through
external auth.

---

## Proposed Model

### Concepts

**ACL catalog**

A curated, code-owned list of stable permission keys. Each entry has:

- `key`: stable machine key, for example `app.write`
- `label`: user-facing label
- `description`: short explanation
- `category`: UI grouping
- `implies`: optional list of ACL keys included by this ACL
- `default_roles`: seeded built-in roles that receive this ACL

The catalog is source-controlled, not user-editable. Role mutations validate
against the catalog.

**Role**

A role is an assignable bundle of ACL grants. A role can be built-in or custom.
Users still reference exactly one role.

**ACL grant**

A role-to-ACL assignment. MVP grants are additive only. There is no deny rule.
At evaluation time Phoenix computes the transitive closure of explicit grants
plus `implies`.

### Built-in Roles

| Role | Assignable | Editable | Semantics |
| --- | --- | --- | --- |
| `SYSTEM` | No | No | Internal service role. Always has all ACLs. Hidden from normal role lists. |
| `ADMIN` | Yes | No in MVP | Full administrative and write access. |
| `MEMBER` | Yes | No in MVP | Current member behavior: can modify application data, cannot manage security/admin settings. |
| `VIEWER` | Yes | No in MVP | Current viewer behavior: read-only application access. |

Built-in roles should be represented in the same tables as custom roles. They
remain protected so migrations and code can rely on them as compatibility
anchors.

### Initial ACL Catalog

The first catalog should map cleanly onto the authorization checks Phoenix has
today. That keeps the migration small and prevents accidental behavior changes.

| ACL key | Description | Initial roles |
| --- | --- | --- |
| `app.read` | Read non-admin application data. | `ADMIN`, `MEMBER`, `VIEWER` |
| `app.write` | Create, update, and delete normal Phoenix resources currently gated by `IsNotViewer` or REST viewer restrictions. | `ADMIN`, `MEMBER` |
| `users.read` | View the user list and user details in settings. | `ADMIN` |
| `users.manage` | Create, update, delete, and assign roles to users. | `ADMIN` |
| `roles.read` | View role definitions and ACL grants. | `ADMIN` |
| `roles.manage` | Create, update, and delete custom roles and grant ACLs. | `ADMIN` |
| `api_keys.create_personal` | Create API keys scoped to the current user. | `ADMIN`, `MEMBER`, `VIEWER` |
| `api_keys.create_system` | Create system API keys. | `ADMIN` |
| `api_keys.delete_own` | Delete own API keys. | `ADMIN`, `MEMBER`, `VIEWER` |
| `api_keys.delete_any` | Delete any user's API key or system API keys. | `ADMIN` |
| `settings.manage_secrets` | Manage stored secrets. | `ADMIN` |
| `settings.manage_models` | Manage model and provider configuration. | `ADMIN` |
| `settings.manage_retention` | Manage retention policies. | `ADMIN` |
| `settings.manage_sandboxes` | Manage sandbox providers and configs. | `ADMIN` |
| `annotations.delete_any` | Delete annotations created by other users. | `ADMIN` |
| `system.admin` | Compatibility grant for admin-only code paths not yet split into a more specific ACL. | `ADMIN` |

`SYSTEM` has all ACLs without needing rows for each grant.

The catalog can become more granular over time. New ACLs must be added with an
explicit migration/update path for existing built-in roles.

---

## Data Model

### Tables

Reuse `user_roles` to minimize churn.

```text
user_roles
  id                 integer primary key
  key                string unique not null
  name               string not null
  description        string null
  kind               enum('SYSTEM', 'BUILT_IN', 'CUSTOM') not null
  is_assignable      boolean not null default true
  created_at         timestamp not null
  updated_at         timestamp not null
  created_by         integer null references users(id) on delete set null
  updated_by         integer null references users(id) on delete set null
```

Migration notes:

- Backfill `key` from current `name`.
- Keep the current `name` field as the display name or migrate current `name` to
  `key` and add a new `display_name`. Pick the lower-risk route during
  implementation after reviewing generated GraphQL types.
- Convert Python `UserRoleName` away from a fixed literal for assignable roles.
- Keep `SYSTEM`, `ADMIN`, `MEMBER`, and `VIEWER` as stable built-in keys.
- Change `users.user_role_id` delete behavior to restrict/no action. Deleting a
  role must never cascade-delete users.

```text
role_acl_grants
  role_id            integer not null references user_roles(id) on delete cascade
  acl_key            string not null
  created_at         timestamp not null
  created_by         integer null references users(id) on delete set null
  primary key (role_id, acl_key)
```

`acl_key` is a string validated by application code against the source-controlled
ACL catalog. A physical `acl_definitions` table is intentionally avoided in the
MVP so adding a catalog entry does not require deployments to carry mutable
definition data.

### Role Keys

Role keys are immutable identifiers used by external auth mapping and APIs.

Rules:

- Built-in keys remain uppercase: `ADMIN`, `MEMBER`, `VIEWER`, `SYSTEM`.
- Custom role keys should be slug-like and case-insensitive unique.
- Display names can be edited.
- Mutations should reject keys that collide case-insensitively with an existing
  role or built-in role.

### Deletion

Custom roles can be deleted only when either:

- no users reference the role, or
- the mutation includes a replacement role ID and Phoenix moves all users in the
  same transaction.

Built-in roles cannot be deleted.

---

## Authorization Design

### Runtime Shape

Extend authenticated user state from role-name booleans to an ACL set:

```python
class PhoenixUser(BaseUser):
    role_id: int
    role_key: str
    acl_keys: frozenset[str]

    def has_acl(self, key: str) -> bool: ...
```

Compatibility properties remain during migration:

```python
is_admin = has_acl("system.admin")
is_viewer = not has_acl("app.write")
```

`PhoenixSystemUser` always returns true for `has_acl("*")` and any concrete ACL
key.

### Token Store

Phoenix JWTs are looked up through the token store by `jti`; the effective role
is already reconstructed from the database during token-store refresh. RBAC
should keep that model:

- Store token rows as today.
- Expand the token-store update query to load role ID, role key, and role ACL
  grants.
- Build `UserTokenAttributes` with role metadata and computed ACL keys.
- Keep access/refresh token logout behavior for explicit role assignment changes.
- When a role's ACL grants change, evict token-store cache entries for users
  assigned to that role or rely on the existing short refresh interval, depending
  on the security bar selected for the implementation.

API keys should evaluate the current grants for their owning user or system
user when the token store refreshes. This keeps a user's API keys aligned with
role changes instead of freezing permissions at key creation time.

### Permission Helpers

Add explicit ACL helpers and migrate existing helpers onto them.

```python
class HasACL(Authorization):
    acl_key: str
    allow_when_auth_disabled: bool = True
```

Suggested compatibility mapping:

| Existing helper | New behavior |
| --- | --- |
| `IsNotViewer` | `HasACL("app.write", allow_when_auth_disabled=True)` |
| `IsAdmin` | `HasACL("system.admin", allow_when_auth_disabled=False)` |
| `IsAdminIfAuthEnabled` | `HasACL("system.admin", allow_when_auth_disabled=True)` |
| `restrict_access_by_viewers` | `require_acl("app.write", allow_when_auth_disabled=True)` for mutating requests |
| `require_admin` | `require_acl("system.admin", allow_when_auth_disabled=True)` |

After the compatibility layer lands, individual admin paths can move from
`system.admin` to specific ACLs such as `settings.manage_secrets` or
`roles.manage`.

### Auth Disabled Mode

Current Phoenix behavior is mixed:

- Some admin-only surfaces are unavailable when auth is disabled (`IsAdmin`).
- Some settings surfaces are available when auth is disabled
  (`IsAdminIfAuthEnabled`).
- Normal writes are available when auth is disabled.

RBAC should preserve this by making the auth-disabled policy an explicit
argument of each authorization helper. Do not infer it from the ACL key.

Read-only mode and storage-lock checks remain separate authorization layers.
`IsNotReadOnly` and `IsLocked` should continue to be composed with ACL checks
instead of becoming ACL grants.

---

## API Design

### GraphQL Types

```graphql
type AclDefinition {
  key: String!
  label: String!
  description: String!
  category: String!
  implies: [String!]!
}

type UserRole {
  id: ID!
  key: String!
  name: String!
  description: String
  kind: UserRoleKind!
  isAssignable: Boolean!
  aclGrants: [String!]!
  effectiveAclGrants: [String!]!
  userCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### GraphQL Queries

```graphql
type Query {
  aclCatalog: [AclDefinition!]!
  userRoles(includeSystem: Boolean = false): [UserRole!]!
}
```

`userRoles` should remain readable to authenticated users if it is only used for
role selectors, but ACL grant details should require `roles.read` unless product
needs otherwise. A conservative MVP can require `roles.read` for the expanded
role management query and expose a separate assignable-role picker.

### GraphQL Mutations

```graphql
input CreateUserRoleInput {
  key: String!
  name: String!
  description: String
  aclGrants: [String!]!
}

input PatchUserRoleInput {
  roleId: ID!
  name: String
  description: String
  aclGrants: [String!]
}

input DeleteUserRoleInput {
  roleId: ID!
  replacementRoleId: ID
}
```

All role mutations require `roles.manage`.

User creation and patching should move from enum inputs to role IDs:

```graphql
input CreateUserInput {
  email: String!
  username: String!
  password: String
  roleId: ID!
  sendWelcomeEmail: Boolean = false
  authMethod: AuthMethod = LOCAL
}

input PatchUserInput {
  userId: ID!
  newRoleId: ID
  newUsername: String
  newPassword: String
}
```

For compatibility, the implementation may temporarily accept the existing
`role` and `newRole` enum fields and translate them to built-in role IDs.
Generated frontend types should migrate to IDs before custom roles are exposed.

### REST API

The v1 users API currently accepts and returns role names. To avoid breaking
clients:

- Keep returning `role` as a role key string.
- Add `role_id`, `role_name`, and optionally `acl_grants`.
- Accept either `role_id` or `role` on create/update.
- Interpret `role` as a role key, not a fixed enum.
- Continue rejecting `SYSTEM` for normal user creation.

---

## Frontend Design

### Viewer Context

Extend the viewer fragment:

```graphql
viewer {
  role {
    key
    name
  }
  aclGrants
}
```

Add client helpers:

```typescript
useViewerHasAcl("app.write")
useViewerCanModify()              // has app.write
useViewerCanManageUsers()         // has users.manage
useViewerCanManageRoles()         // has roles.manage
useViewerCanManageSecrets()       // has settings.manage_secrets
```

Direct checks against `viewer.role.name` should be migrated behind helpers.

### Settings UI

Add a Roles settings surface near Users:

- Role table: name, key, description, users count, built-in/custom badge.
- Create/edit dialog for custom roles.
- ACL picker grouped by catalog category.
- Read-only detail view for built-in roles in MVP.
- Delete action with replacement-role selector when users are assigned.

Update existing user flows:

- `RoleSelect` should query assignable roles instead of using a frontend enum.
- `UsersTable` should display role display names.
- `UserRoleChangeDialog` should use role IDs and display names.
- New local/OAuth/LDAP user forms should default to the built-in `MEMBER` role
  by role key lookup, not enum value.

### API Key UI

`GenerateAPIKeyButton` should use ACLs:

- `api_keys.create_system`: show system key option.
- `api_keys.create_personal`: show personal key option.
- `api_keys.delete_any`: allow deleting other users' keys and system keys.
- `api_keys.delete_own`: allow deleting own keys.

---

## External Auth Mapping

OIDC and LDAP should support custom roles by stable role key.

### OIDC

Current role extraction returns `ADMIN`, `MEMBER`, or `VIEWER`. Change it to
return an arbitrary assignable role key:

- Config parsing validates role-key shape.
- Login-time resolution validates the role exists and is assignable.
- Strict mode fails login when the mapped role is missing.
- Non-strict mode falls back to `VIEWER`.
- `SYSTEM` is always rejected.

### LDAP

LDAP group mappings should likewise allow role keys:

```json
[
  {"group_dn": "cn=mlops,ou=groups,dc=example,dc=com", "role": "mlops-reviewer"},
  {"group_dn": "*", "role": "VIEWER"}
]
```

The existing first-match behavior should remain unchanged.

---

## Security Rules

- Deny by default when auth is enabled and the user lacks the required ACL.
- `SYSTEM` is not assignable through UI, GraphQL, REST, OIDC, or LDAP.
- Built-in roles are non-deletable.
- MVP built-in roles are non-editable to preserve compatibility.
- Deleting a role must never delete users.
- A user cannot change their own role.
- A user cannot delete themselves through role replacement flows.
- Role ACL updates must not leave the deployment without any non-system user
  who has `roles.manage` and `users.manage`.
- The default admin user remains protected by the current safeguards.
- Unknown ACL grants in the database should be ignored at enforcement time and
  surfaced in role-management UI as invalid grants requiring cleanup.

---

## Migration Plan

### Phase 1: Catalog and Compatibility Layer

- Add the ACL catalog in backend code.
- Add role ACL resolution helpers.
- Add `has_acl` to `PhoenixUser`.
- Implement `IsAdmin`, `IsAdminIfAuthEnabled`, and `IsNotViewer` in terms of
  ACLs while preserving current behavior.
- Add frontend viewer ACL helpers while keeping role-name helpers as wrappers.

### Phase 2: Schema

- Add role metadata columns to `user_roles`.
- Add `role_acl_grants`.
- Seed built-in role grants according to the initial catalog.
- Backfill role keys and display names.
- Change role deletion semantics from cascading user deletion to restricted
  deletion.
- Add tests proving `ADMIN`, `MEMBER`, and `VIEWER` retain current access.

### Phase 3: Dynamic Role Assignment

- Replace GraphQL role enum inputs with role ID inputs.
- Update REST v1 user inputs to accept dynamic role keys or role IDs.
- Update frontend role selectors to query assignable roles.
- Keep compatibility translation for built-in enum values until generated
  frontend and public REST clients have moved.

### Phase 4: Role Management UI

- Add Settings > Roles.
- Support create/edit/delete for custom roles.
- Show built-in roles as read-only.
- Show invalid/unknown ACL grants if present.
- Add deletion with replacement role.

### Phase 5: Granular Gate Migration

- Replace broad `system.admin` checks with specific ACLs where useful:
  `settings.manage_secrets`, `settings.manage_sandboxes`,
  `settings.manage_retention`, and so on.
- Replace remaining frontend role-name checks with ACL helpers.
- Remove or narrow compatibility uses of `is_admin` and `is_viewer`.

### Phase 6: External Auth

- Allow OIDC and LDAP mappings to resolve custom role keys.
- Update configuration docs and examples.
- Add login tests for custom role mapping, missing role fallback, and `SYSTEM`
  rejection.

---

## Testing Plan

### Unit Tests

- ACL catalog validation rejects duplicate keys and bad implications.
- Effective grants include implied ACLs.
- Unknown grants are ignored for enforcement.
- Built-in role grant seeding is idempotent.
- Role deletion requires no users or a replacement role.
- Last role-manager guard prevents lockout.

### Backend Integration Tests

- Existing `ADMIN`, `MEMBER`, and `VIEWER` behavior is unchanged.
- GraphQL mutations require the expected ACLs.
- REST mutating routes respect `app.write`.
- Admin settings routes respect their specific ACLs or `system.admin` during
  compatibility phase.
- Role change logs out affected access/refresh sessions.
- API keys pick up current role ACLs after role changes.
- OIDC and LDAP can map to custom role keys.

### Frontend Tests

- Role selector renders custom roles.
- Users table displays custom role names.
- Role management page can create, edit, and delete custom roles.
- Auth guards show/hide controls based on ACLs, not role names.
- Built-in roles are shown read-only.

### E2E Tests

- A custom role with `app.read` only cannot perform writes.
- A custom role with `app.write` can create normal resources but cannot manage
  users.
- A custom role with `users.manage` can manage users but cannot edit role ACLs
  unless it also has `roles.manage`.
- The default built-in roles still pass existing member/viewer/admin E2E tests.

---

## Open Questions

- Should built-in `ADMIN` be editable after the MVP, or should administrators
  clone it into custom roles for any variation?
- Should `api_keys.create_personal` be granted to `VIEWER` to match permissive
  backend behavior, or withheld to match the current disabled frontend button?
- Should role ACL changes immediately revoke API keys for affected users, or is
  token-store refresh sufficient?
- Should role management be available in auth-disabled mode, or remain hidden
  like current user management?
- How granular should the second catalog split be for prompts, datasets,
  evaluators, and experiments?
