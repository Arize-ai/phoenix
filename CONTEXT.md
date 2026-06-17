# Access Control

The language of authorization in Phoenix: who may do what (RBAC), and — later —
to which resources (ABAC). This glossary governs the terms used in the
[RBAC](./internal_docs/specs/rbac.md) and [ABAC](./internal_docs/specs/abac.md)
specs and the code that implements them.

## Language

**Permission**:
A single, Phoenix-defined unit of access written `entity:operation` (e.g.
`project:create`). The smallest thing a role can grant.
_Avoid_: Access control (that names the whole field), scope, privilege, capability.

**Role**:
A named set of permissions a user can be assigned. A user has exactly one role.

**Built-in role**:
One of the four roles Phoenix ships — System, Admin, Member, Viewer. They exist
as rows for assignment, but their permission sets are fixed code constants, not
editable grants. System is internal and never assignable.

**Custom role**:
An administrator-defined role: an immutable slug, an editable display name and
description, and any combination of catalog permissions stored as grant rows.
Assignable like a built-in role.

**Role slug**:
A custom role's immutable, kebab-case identifier set at creation. The stable key
for external-auth (OAuth/LDAP) mappings and the API contract; survives renames
and is portable across deployments. The display name is not stable; the slug is.
_Avoid_: Using the display name or DB id as the external identifier.

**Grant**:
The association of one permission to one role. Grants are additive; there are no
deny grants.

**Permission catalog**:
The complete set of permissions Phoenix defines. Code-owned and fixed (a shipped
enum/registry); administrators choose from it but cannot extend it. Grants
reference catalog entries by stable string key.
_Avoid_: Vocabulary.

## ABAC

**Attribute**:
A typed key/value pair carried by a user or a resource (e.g. `team=ml-platform`).
Phoenix owns the keys; values come from users, resources, and external auth.

**Condition**:
An optional attribute-match predicate on a single grant, comparing a user
attribute to a resource attribute (e.g. `user.team == resource.team`). A grant
with no condition is global; with one, it applies only to matching resources.
Built-in roles have no grant rows and so are always global.
