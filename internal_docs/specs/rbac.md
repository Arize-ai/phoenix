# Declarative RBAC

## Summary

Phoenix has a fixed set of roles: System, Admin, Member, and Viewer. Their
permissions are hard-coded, so administrators cannot create roles that sit
between them.

This proposal makes *role membership* data. Phoenix still owns the permission
catalog — the fixed vocabulary of things a role can grant — but a role becomes a
named set of permissions drawn from that catalog, and administrators can create
their own roles and assign users to them. Phoenix owns the vocabulary;
administrators combine it.

The first version is global. It answers "what can this user do in Phoenix?",
not "what can this user do to this specific project, dataset, or prompt?" (that
is [ABAC](./abac.md), which builds on this model).

## Goals

- Administrators can create roles from a curated catalog of permissions.
- Administrators can assign users to those roles.
- Existing Admin, Member, and Viewer behavior is unchanged.
- One user has one role.
- OAuth and LDAP group mapping can later target custom roles.

## Non-Goals

- Resource-scoped permissions (per project, dataset, etc.) — see ABAC.
- Multiple roles per user.
- User-defined permissions (administrators combine the catalog; they cannot
  extend it).
- Deny rules or role precedence.
- Replacing operational protections such as read-only mode and storage locks.
- An audit-log system.
- Scoped API keys ship in a later phase (see below), not in the first release.

## Current Model

Role names live in the database, but permissions do not. Backend and frontend
code checks role names directly ("is admin", "is not viewer"). In practice
enforcement today is three tiers: read for everyone, an `IsNotViewer` gate on
almost every mutation, and an `IsAdmin` gate on a small set (user management,
secrets, custom model providers, project delete). That works for a small fixed
set of roles but cannot express anything in between.

The role name is also baked into the token/API-key claims at issue time, so
authorization does no database read — and a role change does not reach a
long-lived API key until the key is reissued. The new model changes this (see
Authorization).

## Model

### Permissions

A permission is a Phoenix-owned unit of access named for the entity it governs
and the operation it allows, written `entity:operation` — for example
`project:create`, `project:update`, `prompt:delete`, `user:invite`. (We say
*permission*, not "access control"; "access control" names the whole field.)

The catalog of valid permissions is **code-owned and fixed**: Phoenix ships it
as a registry, version-controls it, and validates grants against it. It is not a
table administrators can append to. "Making permissions data" means *grants* —
which permissions a role holds — are data; the catalog itself is code.

The grammar is fixed:

- **entity** — the resource or capability being governed (`project`, `prompt`,
  `dataset`, `user`, `role`, `api-key`, `retention`).
- **operation** — what the role may do to that entity. Most entities expose the
  standard `create`, `read`, `update`, and `delete` operations, but an entity
  may define verbs that fit it better (for example `retention:increase` and
  `retention:decrease` instead of `update`).
- Both segments are lowercase; a multi-word segment uses a hyphen
  (`api-key:create`), never camelCase.

Example catalog (illustrative, not final):

| Permission | Allows |
|---|---|
| `project:read` | View projects and their traces |
| `project:create` | Create projects |
| `project:update` | Rename and configure projects |
| `project:delete` | Delete projects |
| `prompt:update` | Create and edit prompts |
| `dataset:update` | Create and edit datasets |
| `user:invite` | Invite and deactivate users |
| `role:update` | Create, edit, and delete custom roles |
| `api-key:create` | Create and rotate API keys |
| `secret:update` | Manage integration credentials |

The catalog starts **coarse**, mirroring today's actual gates: the `IsNotViewer`
mutations collapse into a handful of `entity:*` permissions, and the `IsAdmin`
gates into `user:invite`, `secret:update`, `role:update`, and the like. A
permission is split (the `retention:increase` / `retention:decrease` pattern)
only when a concrete custom-role least-privilege case demands it. Splitting later
is cheap — grant both halves to the roles that had the whole; over-fragmenting up
front is expensive and untestable.

### Roles

A role is a named set of permissions. A user has exactly one role.

Built-in roles remain: System (internal, never assignable), Admin, Member, and
Viewer, each keeping today's behavior. Their permission sets are **fixed code
constants**, not editable grant rows — they exist as rows for assignment, but
behavior preservation is diffable in code rather than seeded into a migration
that could drift. Custom roles, by contrast, store their grants as data.

Both built-in and custom roles resolve through one path: "does the effective
permission set contain `X`?" There is no separate name-based fast path to
maintain.

### Custom Roles

A custom role is an administrator-defined role: any combination of permissions
from the catalog, given a slug, name, and description. Custom roles exist
alongside the built-in roles and are assignable like them.

- Only administrators (anyone holding `role:update`) can create, edit, and
  delete custom roles, subject to the escalation guards below.
- A custom role holds any combination of catalog permissions; it cannot grant a
  capability that has no permission.
- Custom roles are global, matching the first version's scope: a role grants the
  same access everywhere in Phoenix, not per project or dataset.
- A custom role carries an **immutable kebab-case slug** set at creation (e.g.
  `data-steward`). The slug is the stable identifier for external-auth mappings
  and the API contract; the display name and description are freely editable. The
  slug never changes and is portable across deployments — unlike the display name
  or the DB id.

Built-in roles are not editable. To customize, **clone** a built-in into a new
custom role and edit the clone; the built-ins stay as the behavior-preservation
anchor and migration baseline.

Splitting an entity's operations lets a custom role grant least privilege.
Because `retention:increase` and `retention:decrease` are separate permissions, a
role can let someone reclaim storage by shortening retention without letting them
inflate cost by lengthening it. Likewise `user:invite` is independent of
`role:update`, so a role can onboard people without granting control over roles.
The built-in roles bundle these permissions to preserve today's behavior.

Example custom roles composed from the catalog:

- **Data Steward** — `project:read`, `project:update`, `dataset:update`,
  `prompt:update`, `retention:decrease`. Curates content and shrinks retention,
  but cannot delete projects, lengthen retention, or manage users.
- **User Admin** — `project:read`, `user:invite`. Onboards people without editing
  data or touching secrets.

### Grants

A grant gives a role one permission. Grants are additive: users in a role can do
exactly what its grants allow, nothing more. There are no deny grants.

## Product Behavior

### Role Management

Administrators can view all roles and create, edit, and delete custom roles.
Built-in roles are visible but read-only. Deleting a custom role requires that it
has no users, or that a replacement role is chosen for them.

Role management is **hidden when authentication is disabled** — with no
authenticated users, roles enforce nothing, consistent with how user management
is already treated.

### User Management

Users can be assigned any assignable role, including custom roles. System is
never assignable through any surface. Users cannot change their own role.

### Authorization

Checks move from "is this user an Admin?" to "does this user's role grant this
permission?" The first implementation maps existing role behavior onto the new
model, so existing deployments see no access changes.

Effective permissions are resolved **live from the database** on each request,
behind a short-TTL/invalidated cache — not snapshotted into the token claims.
This is a departure from today's claims-only path, and it is what makes role
edits take effect immediately and makes "narrowing the role narrows the key"
true. Token/key claims carry only a role reference (and, later, a key's own grant
subset); the effective set is computed from current grants.

### Escalation Guards

Because `role:update` is itself a grantable permission, custom roles introduce a
self-escalation surface that built-in admin never had. Two rules close it:

- **No self-edit.** A user may edit or delete any custom role *except the one
  they are currently assigned to*. (Combined with "users cannot change their own
  role," neither the grants of your role nor your assignment can be escalated by
  you.)
- **No grant above self.** A user cannot grant a permission they do not
  themselves hold. This prevents minting a super-role from a partial one.

### API Keys (later phase)

Scoped API keys ship after the permission-resolution path is proven; until then a
key inherits its owner's role in full. When scoping lands:

- An API key can carry its own subset of permissions, stored as the literal
  chosen set.
- A key's effective access is the **intersection** of its grants and the owner's
  *current* role, evaluated live: a key can never exceed the role, narrowing the
  role narrows the key, and a key scoped to `[project:read]` stays
  `[project:read]` even if the role later gains more.
- A key with no explicit grants inherits the owner's current role, so scoping is
  opt-in.

Viewers keep the ability to create personal API keys: such a key is intersected
with the read-only Viewer role, so it can only read — removing this would be a
behavior change.

### External Auth

OAuth and LDAP role mapping keeps working with built-in roles (mapped by name)
and can later target custom roles by their **immutable slug**. If a provider maps
a user to a missing or unassignable role, existing behavior applies: strict mode
rejects the login; non-strict mode falls back to least privilege.

## Rollout

1. Define the permission catalog (in code) and map the built-in roles onto it as
   code constants. No behavior change.
2. Add role management: create, edit, delete, and assign custom roles, with the
   escalation guards.
3. Move backend and frontend checks from role names to permissions, resolved live
   from the database, incrementally.
4. Let OAuth and LDAP mappings target custom roles by slug.
5. (Later) Scoped API keys.

## Security Guardrails

- Deny by default when a role lacks the needed permission.
- System stays internal and unassignable.
- Built-in roles are read-only; customize by cloning.
- The **default admin account is permanently Admin and unmodifiable** — the
  bulletproof, race-free backstop against locking the deployment out of role and
  user management. (A best-effort "you're removing the last manager" warning may
  supplement it, but the immutable default admin is the hard guarantee.)
- Users cannot change their own role, edit their own role's grants, or grant a
  permission they do not hold.
- Deleting a role never deletes users.
- Unknown grants are invalid configuration, not allowed access.
- Read-only mode and storage locks stay separate from RBAC.

## Open Questions

- Should built-in roles ever become editable, or is clone-to-custom the permanent
  answer? (Current decision: clone only.)
- How granular should the catalog get for prompts, datasets, evaluators, and
  experiments — i.e. which least-privilege cases justify splitting a permission?
- What cache invalidation strategy backs live permission resolution (TTL,
  event-driven, or both)?
