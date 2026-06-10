# Declarative RBAC

## Summary

Phoenix currently has a small fixed set of roles: System, Admin, Member, and
Viewer. Those roles are useful, but the permissions behind them are implicit in
the application. This makes it hard for administrators to create roles that
match how their teams actually work.

This proposal extends the current model with declarative roles. A role becomes
a named bundle of access controls, and administrators can assign users to those
roles. Phoenix continues to own the access-control vocabulary so the product
stays understandable, supportable, and safe.

The first version should stay global. It should answer "what can this user do in
Phoenix?" rather than "what can this user do to this specific project, dataset,
or prompt?"

## Goals

- Let administrators create custom roles from a curated set of Phoenix access
  controls.
- Let administrators assign users to those roles.
- Preserve the behavior of the existing Admin, Member, and Viewer roles.
- Keep the model simple: one user has one role.
- Make the access model easier to explain, audit, and extend.
- Leave room for OAuth and LDAP group mapping to assign custom roles later.

## Non-Goals

- Resource-scoped permissions, such as project-level or dataset-level access.
- Multiple roles per user.
- Custom access-control definitions created by end users.
- Deny rules or complex role precedence.
- Replacing operational protections such as read-only mode or storage locks.
- Building a full audit-log system as part of the first release.

## Current Model

Today, Phoenix roles are fixed. Admins can manage the system, Members can modify
most product data, and Viewers are read-only. System is reserved for internal
service behavior.

The role names are stored in the database, but the permissions are not described
as data. Instead, Phoenix checks for broad concepts like "admin" or "not
viewer" in backend and frontend code. This works for the current fixed roles,
but it does not give administrators a way to express intermediate roles.

Examples of roles customers may want:

- Evaluator Author: can create and edit evaluators, but cannot manage users or
  secrets.
- Prompt Manager: can manage prompts and provider configuration, but cannot
  delete users.
- Analyst: can read Phoenix data and create personal API keys, but cannot modify
  shared resources.

## Proposed Language

### Access Controls

An access control is a Phoenix-owned permission concept. Access controls should
be named around product capabilities, not implementation details.

Examples:

- Read application data
- Modify application data
- Manage users
- Manage roles
- Manage secrets
- Manage model providers
- Manage retention policies
- Manage sandbox settings
- Create personal API keys
- Create system API keys
- Delete annotations created by other users

Phoenix should keep this catalog curated. Administrators choose from the catalog;
they do not create new access-control types.

### Roles

A role is a named bundle of access controls.

Built-in roles remain:

- System is internal and not assignable.
- Admin has full administrative access.
- Member keeps today's normal write access.
- Viewer keeps today's read-only behavior.

Custom roles are administrator-defined bundles. A custom role has a name,
description, and selected access controls. Users can then be assigned to that
role from user management.

### Grants

A grant is the assignment of an access control to a role. Grants are additive.
If a role has a grant, users in that role can perform that capability. If it
does not, they cannot.

The first version should not support deny grants. Deny rules make the model much
harder to explain and are unnecessary while users have only one role.

## Product Behavior

### Role Management

Administrators should be able to view all roles, create custom roles, edit
custom roles, and delete custom roles when safe.

Built-in roles should be visible but protected. In the first release, they
should not be editable or deletable. This keeps the migration predictable and
preserves existing expectations.

Deleting a custom role should require either no assigned users or an explicit
replacement role for those users.

### User Management

User creation and editing should allow assignment to any assignable role,
including custom roles. System should never be assignable through the UI,
GraphQL, REST, OAuth, or LDAP.

Users should not be able to change their own role. Phoenix should also prevent
administrators from removing the last user who can manage users and roles.

### Authorization

Phoenix should gradually move from role-name checks to access-control checks.
The first implementation can preserve existing behavior by mapping current role
semantics into the new access-control model.

The important product shift is that Phoenix should ask "does this user's role
grant this capability?" rather than "is this user an Admin, Member, or Viewer?"

### External Auth

OAuth and LDAP role mapping should continue to work with the built-in roles.
After custom roles exist, those mappings should be able to target custom role
keys as well.

If an external identity provider maps a user to a missing or unassignable role,
Phoenix should follow the existing strict versus non-strict behavior:

- Strict mode rejects the login.
- Non-strict mode falls back to least privilege.

## Rollout

### Phase 1: Define the Catalog

Create the initial Phoenix access-control catalog and map the built-in roles to
it. The catalog should be small and aligned to product surfaces users already
understand.

### Phase 2: Preserve Existing Roles

Represent Admin, Member, and Viewer through the new model without changing their
behavior. Existing deployments should see no access changes after upgrade.

### Phase 3: Add Custom Roles

Add role management for administrators. Custom roles can be created from the
curated access-control catalog and assigned to users.

### Phase 4: Move Checks to Access Controls

Update backend and frontend authorization checks to use access controls instead
of role names. This can happen incrementally, starting with broad compatibility
checks and becoming more specific over time.

### Phase 5: Extend External Mapping

Allow OAuth and LDAP mappings to assign custom roles by stable role key.

## Security Guardrails

- Deny access by default when a user lacks the needed access control.
- Keep System internal and unassignable.
- Keep built-in roles protected in the first release.
- Prevent role deletion from deleting users.
- Prevent users from changing their own role.
- Prevent lockout by ensuring at least one non-system user can manage users and
  roles.
- Treat unknown access-control grants as invalid configuration, not as allowed
  access.
- Keep operational protections, such as read-only mode and storage locks,
  separate from RBAC.

## Open Questions

- Should built-in roles become editable later, or should administrators clone
  them into custom roles when they need variations?
- Should Viewers be allowed to create personal API keys, matching backend
  behavior today, or should the product make that unavailable?
- How granular should the catalog become for prompts, datasets, evaluators, and
  experiments?
- Should role changes immediately revoke active API keys, or should API keys
  pick up new permissions on the normal refresh path?
- Should role management be visible when authentication is disabled?
