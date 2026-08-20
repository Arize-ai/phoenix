# Attribute-Based Access Control

> **Status: design-only, deferred.** The data model below is committed, but ABAC
> is *not* next-up. It is blocked on a resource-attribution foundation that does
> not exist today (see Prerequisites). Ship [RBAC](./rbac.md) first.

## Summary

[Declarative RBAC](./rbac.md) answers "what can this user do in Phoenix?" with a
global role. ABAC extends it to answer "what can this user do to *this*
resource?" by matching attributes on the user against attributes on the
resource.

A user carries attributes such as `team`, `department`, or `environment`.
Resources carry the same attributes. A grant can then require that they match —
`project:update` *when* the user's `team` equals the project's `team` — so one
role grants the right access across many resources without a policy per team.

ABAC builds on RBAC; it does not replace it. The role still defines *which*
`entity:operation` permissions a user holds. ABAC adds *which resources* each
permission applies to.

## Goals

- Scope a permission to resources whose attributes match the user's.
- Reuse the RBAC permission catalog unchanged.
- Add users, teams, and resources without editing existing roles.

## Non-Goals

- Replacing roles or the global grants from RBAC.
- A general policy language — boolean logic, deny rules, allow/deny precedence.
  Phoenix keeps RBAC's additive grant model: conditions narrow access, they never
  deny it.
- Attribute sources beyond what RBAC and external auth already provide.

## Prerequisites

ABAC compares user attributes to resource attributes, but **Phoenix resources
carry no attributes today** — `projects` has no owner/creator/team column, and
neither do datasets or prompts. There is nothing to match against and nothing to
inherit from. Before ABAC is buildable:

1. **A resource-attribution foundation.** Resources need a place to hold typed
   attributes, and a source for their values — most plausibly a `created_by`
   captured at creation, from which attributes can be inherited, plus a generic
   attribute/tag store.
2. **A migration story for the existing corpus.** Every existing resource is
   untagged. A strict condition `user.team == resource.team` denies any resource
   missing `team` (null matches nothing), so turning it on would make the entire
   un-tagged corpus invisible — a cliff. The match-if-absent condition behavior
   (see Evaluation) is the escape hatch, but a concrete backfill plan still belongs
   to this foundation, not assumed here.

Until these exist, this spec is a design reference, not an implementation plan.

## Model

### Attributes

A typed key/value pair on a user or a resource — for example `team=ml-platform`.
Phoenix owns the attribute keys; values come from users, resources, and external
auth (OAuth/LDAP) mappings.

Example keys:

- `environment` — `production`, `staging`, `dev`
- `team` — `ml-platform`, `growth`
- `department` — `engineering`, `research`

On resources these attributes take the form of **tags** — user-assigned key/value
labels carried by the resource (a tag store is the most plausible concrete
foundation; see Prerequisites). Resources that carry no tags of their own inherit
from a parent: a trace's attributes are its project's tags, so `trace:read` is
evaluated against the parent project rather than requiring every trace to be
tagged.

A condition such as `trace:read` *when* `user.environment == resource.environment`
lets one role give each user access only to their own environment's data.

### Conditions

A condition attaches to the **grant** — the `(role, permission)` association from
RBAC — not to the role or the catalog entry. This is what lets one role hold
`project:update` *when* `user.team == resource.team` while keeping `project:read`
global; a condition on the role would force all its permissions to share one
predicate, and a condition on the catalog would make the permission conditional
everywhere it is used.

- `project:update` *when* `user.team == resource.team`
- `dataset:read` *when* `user.department == resource.department`

Equality is the common case, but a condition is not limited to it: comparisons may
be case-insensitive, and a value may match a glob pattern (`environment` matches
`prod-*`) so one condition covers a family of related tag values without a grant
per value.

A grant with no condition stays global, exactly as in RBAC. Built-in roles have
no editable grant rows, so they are always global — only custom roles carry
conditions.

### Evaluation

Authorization first resolves the RBAC grant (does the role hold the permission?),
then evaluates any condition against the target resource. Both must pass. No
condition means the global grant stands.

When the resource is missing the attribute a condition names, the condition
carries its own behavior — set per condition, not globally:

- **strict** — a missing attribute fails the condition, so the resource is denied.
  This is the default and gives hard isolation: `user.team == resource.team` hides
  every untagged resource.
- **match-if-absent** — a missing attribute passes the condition, falling back to
  the global grant. This keeps the existing un-tagged corpus visible while it is
  being backfilled, instead of a cliff where turning on one condition hides
  everything (see Prerequisites).

The per-condition choice is the lever for migration: ship conditions as
match-if-absent, backfill tags, then tighten the ones that need hard isolation to
strict.

## Open Questions

- Which attribute keys ship first, and where do their values come from?
- Which conditions default to strict vs. match-if-absent at launch, and how is the
  existing corpus backfilled with tags?
