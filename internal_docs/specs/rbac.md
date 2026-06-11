# Declarative RBAC

## Summary

Phoenix has a fixed set of roles: System, Admin, Member, and Viewer. Their
permissions are hard-coded, so administrators cannot create roles that sit
between them.

This proposal makes permissions data. A role becomes a named set of access
controls, and administrators can create their own roles and assign users to
them. Phoenix owns the access-control vocabulary; administrators combine it.

The first version is global. It answers "what can this user do in Phoenix?",
not "what can this user do to this specific project, dataset, or prompt?"

## Goals

- Administrators can create roles from a curated set of access controls.
- Administrators can assign users to those roles.
- Existing Admin, Member, and Viewer behavior is unchanged.
- One user has one role.
- API keys can be scoped to a subset of the owner's access controls.
- OAuth and LDAP group mapping can later target custom roles.

## Non-Goals

- Resource-scoped permissions (per project, dataset, etc.).
- Multiple roles per user.
- User-defined access-control types.
- Deny rules or role precedence.
- Replacing operational protections such as read-only mode and storage locks.
- An audit-log system.

## Current Model

Role names live in the database, but permissions do not. Backend and frontend
code checks role names directly ("is admin", "is not viewer"). That works for
a small fixed set of roles but cannot express anything in between.

## Model

### Access Controls

An access control is a Phoenix-owned permission named after a product
capability — for example "Read application data", "Modify application data",
"Manage users", "Manage secrets". Phoenix curates the catalog; administrators
choose from it but cannot add to it.

### Roles

A role is a named set of access controls.

Built-in roles remain: System (internal, never assignable), Admin, Member, and
Viewer, each keeping today's behavior. A custom role has a name, a description,
and a set of access controls.

### Grants

A grant gives a role one access control. Grants are additive: users in a role
can do exactly what its grants allow, nothing more. There are no deny grants.

## Product Behavior

### Role Management

Administrators can view all roles and create, edit, and delete custom roles.
Built-in roles are visible but read-only in the first release. Deleting a
custom role requires that it has no users, or that a replacement role is chosen
for them.

### User Management

Users can be assigned any assignable role, including custom roles. System is
never assignable through any surface. Users cannot change their own role, and
Phoenix must never allow the last user who can manage users and roles to be
removed or demoted.

### Authorization

Checks move from "is this user an Admin?" to "does this user's role grant this
access control?" The first implementation maps existing role behavior onto the
new model, so existing deployments see no access changes.

### API Keys

An API key can carry its own set of access controls. A key's effective access
is the intersection of its grants and the owner's role: a key can never exceed
the role, and narrowing the role narrows the key. A key with no explicit grants
inherits the owner's role, so scoping is opt-in.

### External Auth

OAuth and LDAP role mapping keeps working with built-in roles and can later
target custom roles by a stable role identifier. If a provider maps a user to a missing or
unassignable role, existing behavior applies: strict mode rejects the login;
non-strict mode falls back to least privilege.

## Rollout

1. Define the access-control catalog and map the built-in roles onto it. No
   behavior change.
2. Add role management: create, edit, delete, and assign custom roles.
3. Move backend and frontend checks from role names to access controls,
   incrementally.
4. Let OAuth and LDAP mappings target custom roles.

## Security Guardrails

- Deny by default when a role lacks the needed access control.
- System stays internal and unassignable.
- Built-in roles are read-only in the first release.
- Deleting a role never deletes users.
- Users cannot change their own role.
- At least one user must always be able to manage users and roles.
- Unknown grants are invalid configuration, not allowed access.
- Read-only mode and storage locks stay separate from RBAC.

## Open Questions

- Should built-in roles become editable later, or cloned into custom roles?
- Should Viewers keep the ability to create personal API keys?
- How granular should the catalog get for prompts, datasets, evaluators, and
  experiments?
- Do role changes apply to active API keys immediately or on the normal
  refresh path?
- Should scoped API keys ship with custom roles or as a later phase?
- Should role management be visible when authentication is disabled?
