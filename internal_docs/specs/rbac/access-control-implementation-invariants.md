# Access-Control Implementation Invariants

This note is the implementation companion to the Phoenix access-control design. The
[survey](./access-control-survey.md) defines the model and a product-neutral vocabulary; the
[Phoenix design notes](./phoenix-access-control.md) choose the product semantics and record the
forks. This document names the edge-case invariants that keep the implementation faithful to
those choices — the properties a reader should be able to assume, and a reviewer should defend,
when touching authorization code.

The examples are intentionally concrete. Authorization bugs are easiest to miss when described
as abstract operators and easiest to remember when walked through as a small story. Each section
runs the same beats: a **Story** (the concrete failure), the **Principle** it offends (the design
rule we reason from), the **Invariant** that principle demands, the **Requirement** on the
implementation, and a **Test / guardrail** — closing with a **Status** tag for where the prototype
stands. The principle is the general commitment; the invariant is the specific property that
commitment forces.

## How to read this

**Reference model.** Effective access composes as:

```text
effective = ( admin-baseline  ∪  reaching-grants  ∪  permission-sets )
            ∩  global-read-only-role
            ∩  credential-scope
```

An additive `∪` core (allow-only, monotonic, fail-closed) bounded by two coarse `∩` caps.
There is deliberately **no `∖` (deny)** operator and no per-object exception — see
[design notes](./phoenix-access-control.md) §2.13. Consequences of that choice recur below.

**Vocabulary.**

- **Oracle** — the single seam that answers "may subject S do action A on object O?", in three
  shapes: a point check (`can_access`), a list predicate (`accessible_scope` /
  `access_predicate`), and an audit view (`subjects_for`).
- **Access root** — a top-level grantable object: a project, dataset, or prompt. Derived
  children (an experiment's or evaluator's trace project) are **not** roots; they inherit
  access from a parent root (see Part D).
- **Cap** — a coarse `∩` bound: the global read-only role (`VIEWER`) and the credential scope
  on an API key. Caps only ever *remove* authority.
- **Reaching grant** — a grant that names the object by id, by type-wide `all`, or through a
  parent edge.

**Status tags.** Each invariant is tagged with where the current prototype stands, so target
state is not confused with shipped behavior:

- **Holds** — the code already maintains this; the invariant is a guard-rail against regression.
- **Gap** — the code violates or does not yet enforce this; it is an implementation task.
- **Proposed** — this depends on a mechanism not built yet, or a product decision not made yet.

**Reading guidance.** Two rules cut across everything. *Oracle first:* final effective access
is the oracle's answer; coarse mutation guards may reject a request for operational reasons but
must not be the only place a semantic lives. *Coverage counts:* an invariant about the oracle's
answer is worthless on a surface that never calls the oracle.

---

# Part A — One decision, applied everywhere

## A1. The oracle owns effective access

### Story: Morgan owns it, but still cannot write

Morgan creates a dataset as a `MEMBER`. Later an admin demotes Morgan to `VIEWER`. The dataset
still records Morgan as creator, so ownership still explains why Morgan can *read* it — but
`VIEWER` is a global read-only cap, so Morgan may not edit it or grant access to anyone.

Today that "no" comes from a GraphQL mutation gate (`IsNotViewer`), while the oracle, asked in
isolation, would say Morgan *may* manage the dataset (creator ownership confers manage
unconditionally). Two layers, two answers. The first script, REST route, or background job that
consults only the oracle will get the permissive one.

Two identities sit deliberately *above* the additive machinery, and both are centralized in the
oracle rather than scattered as per-resolver bypasses: an `ADMINISTER` holder (`ADMIN` /
`SYSTEM`) short-circuits to universal access, and enforcement-disabled makes everything
accessible. Credential scope is the one cap that still binds even an admin — it attenuates at
the protocol boundary regardless of role.

**Principle:** access has one source of truth — a subject's effective authority is a single
function of identity, grants, and caps, not something each surface re-derives.

**Invariant:** final effective access is computed by the oracle, including the global read-only
cap. Grants and ownership add authority; global role and credential scope cap it; `ADMINISTER`
and enforcement-disabled are explicit oracle-level rules.

**Requirement:** `can_access` / `accessible_scope` must apply the same cap semantics that write
mutations rely on, so a downgraded creator is denied writes *by the oracle*, not only by a
resolver gate. Mutation permission classes may remain as coarse preconditions (read-only mode,
storage lock, authentication present) but must not be the sole carrier of an access semantic.

**Test / guardrail:** a creator downgraded to `VIEWER` can still read their creator-private
dataset but cannot edit it or manage its access through *any* surface, and the denial is
explainable as an oracle cap.

**Status:** Gap — the `VIEWER` write-cap currently lives in the `IsNotViewer` gate, not the
oracle. See [design notes](./phoenix-access-control.md) §2.13 (read-only cap vs. per-object lift).

## A2. Coverage is part of correctness

### Story: The perfect oracle nobody called

A correct oracle protects nothing on a surface that bypasses it. A list resolver may apply the
access predicate while a nested field resolver, a `node(id:)` lookup, an export endpoint, or a
metrics aggregate loads the same object without it. The model is enforced by being *applied*
everywhere data crosses a boundary, not by existing.

**Principle:** a control is only as strong as the surfaces that invoke it; correctness is a
property of the whole request surface, not of the decision function in isolation.

**Invariant:** every read and write surface routes the same resource/action pair through the
same access decision.

**Requirement:** maintain an inventory of access-derived operations — list, point-get, node
lookup, count, aggregate, export, autocomplete, subscription, mutation, transfer, background
runner reads — each naming the oracle call or SQL predicate it uses. Missing or malformed object
identity must fail closed; helper code must not treat "no id" as "no check needed" unless the
operation is explicitly objectless (see A3's fail-open note).

**Test / guardrail:** a user who cannot read an object through the canonical point check also
fails through GraphQL `node`, REST, export, aggregate, and derived-child queries. Null, missing,
and malformed ids deny rather than silently skipping the predicate.

**Status:** Gap — enforcement is opt-in per surface; nested resolvers and objectless helpers are
the main exposure.

## A3. Denial is indistinguishable from absence

### Story: The 404 that does not leak

A user asks for a dataset they may not see. The system must not answer "403 Forbidden" — that
confirms the dataset *exists*. It answers as if the object is not there: not-found / null, the
same response an unknown id would produce. Existence itself is information.

The mirror hazard is a helper that short-circuits the wrong way: a guard shaped
`if object_id is None: return` grants access on a missing id instead of denying it — an
allow-by-default branch inside a deny-by-default system.

**Principle:** fail closed, and reveal nothing — the existence of a resource is itself
privileged information, so the error channel must not leak it.

**Invariant:** unauthorized and non-existent are indistinguishable to the caller. Denial reveals
nothing an unknown id would not.

**Requirement:** point checks surface denial as not-found / null, never as a distinct
"forbidden" that leaks existence. Guards fail closed on absent or malformed identity.

**Test / guardrail:** the response for "object you may not see" is byte-for-byte the response for
"object that does not exist." No helper returns access-granted on a null/missing id.

**Status:** H/G — the two halves of this invariant stand differently. *Not-found masking
Holds*: the oracle and REST helpers surface unauthorized as not-found. *Fail-closed-on-missing-id
is a Gap*: at least one experiment helper returns access-granted when the parent dataset id is
absent, an allow-by-default branch to close.

## A4. Enforcement is a latched deployment decision, and presupposes authentication

### Story: The instance with grants but no subjects

Enforcement is a deployment-level switch (`access_control.enabled`), reconciled once from the
environment at startup; the running app exposes no runtime enable/disable path. Turning it on is
a deliberate operator action, not a per-request condition.

Now suppose an operator enables access control but disables authentication. Requests carry no
durable subject, so the oracle has no identity to evaluate. Grant checks and admin checks cannot
mean what they meant under auth-on: the instance is open by configuration. That is fine for an
*intentionally* open deployment — but it is not a restricted deployment running in a degraded,
partially-enforced mode.

**Principle:** authorization presupposes authentication — you cannot restrict access for a
subject you cannot identify, so there is no partially-enforced state, only enforcing-with-identity
or open.

**Invariant:** access control presupposes authentication. Auth-off means there is no subject for
the model to evaluate; enforcement is a startup-latched, deployment-wide decision, not a runtime
toggle.

**Requirement:** an access-control-on, auth-off configuration must fail loudly before serving
traffic rather than silently running open. Helpers may no-op under auth-off only because the
deployment is explicitly open; they must not present grant state as enforced security.

**Test / guardrail:** startup rejects access-control-on plus auth-off. With auth intentionally
off, access helpers behave as consistent open-mode helpers.

**Status:** H/P — two claims Hold (the startup-only enforcement latch with no runtime toggle,
and the auth-presupposition: no subject under auth-off); one is Proposed (a *loud startup
rejection* of access-control-on + auth-off — no such guard exists today, so that config runs
silently open).

---

# Part B — Ownership and the subject lifecycle

## B1. Creator ownership is data, not role

### Story: Priya leaves, and her private dataset loses its owner

Priya creates a dataset; its creator-private access is carried by a `user_id` column. Role
changes never touch that column — which is exactly why a downgraded creator keeps ownership
(A1). But when Priya is deprovisioned, the user row is deleted and the column becomes null. The
dataset does not become public and does not remember a ghost owner; it becomes reachable only
through explicit grants or administrator authority — a fail-closed, but silent, outcome.

**Principle:** ownership and role are independent facts with independent lifecycles; authority
carried by stored data ages with the data, and identity-lifecycle events are authorization
events.

**Invariant:** creator ownership is a stored relationship. Role changes do not remove it;
identity deletion does.

**Requirement:** deprovisioning must surface the creator-private resources that will lose their
owner, transfer them, or accept the admin-only outcome explicitly. Silent orphaning is a product
event, not an implementation detail.

**Test / guardrail:** deleting a creator removes creator-derived access without granting it to
anyone else, and the deprovisioning path records or exposes the affected resources before the
owner relationship is destroyed.

**Status:** the mechanism (ownership survives demotion, dies with the identity) Holds. Surfacing
the orphaned-island outcome on deprovision is a Gap.

## B2. Enforcement and audit must share one ownership rule

### Story: One prompt, many authors

Alex creates a prompt; Blake later adds a version. Prompt ownership is derived from version
authorship, so if *any* version author is an owner, Blake now holds owner-level authority over
the whole prompt — not just the version Blake wrote. Meanwhile the "who can access this?" audit
answer reports only the first version's author. Enforcement grants owner rights to several
people; the audit view names one. The panel under-reports real access.

**Principle:** the system must enforce and explain the same model — an audit view that diverges
from the enforced rule misinforms rather than informs.

**Invariant:** enforcement (`can_access`, `accessible_scope`) and explanation (`subjects_for`)
must apply the *same* ownership rule.

**Requirement:** choose one prompt-owner model and apply it everywhere — one owner, or all
version authors as owners, or authorship granting only author-scoped edit. Until decided, prompt
ownership is an open product question, not a code detail; the oracle, `subjects_for`, and UI copy
must agree.

**Test / guardrail:** for a prompt with versions from multiple users, the point check, list
filter, and audit view identify the same owner-derived subjects.

**Status:** Gap — the audit view and the enforcement paths disagree today; the multi-author
ownership model is also an open product decision.

## B3. Creatorless objects need last-manager protection

### Story: Dana locks herself out

Dana manages the `Fraud-Signals` project. She did not create it — a tracing pipeline did, and
projects have no creator owner — so her authority is a single manager grant. Cleaning up stale
access, she removes that grant by mistake. Next request, the project is gone from her list, and
she cannot grant it back because granting requires manage access she no longer holds. An admin
can recover it, but the system should not strand a creatorless object because the last delegated
manager clicked the wrong row.

**Principle:** no single routine action should make a resource permanently unreachable to every
non-privileged user; recoverability is a design requirement — the last-admin instinct, one level
down.

**Invariant:** delegated manage access on a creatorless resource is *destructible* authority.
Removing the last non-admin manager can reduce the object to admin-only.

**Requirement:** default to a last-manager guard — refuse removal of the final non-admin manager
of a creatorless object unless another remains. The guard must fire on *every* lever that can
strip the last manager, not only the obvious grant delete: an in-place downgrade and a
permission-set edit/delete reach the same state by different doors (below). If the product
intends to allow an object to become admin-only, that path is explicit, admin-visible, and
audited as a recovery-state transition, not an ordinary revoke.

*Two per-grant paths remove a manager, and both must be guarded.* Deleting the grant is the
obvious one; **downgrading it in place** — re-granting the same subject as viewer/editor — strips
manage just as completely, so the guard fires on that change too (skipping only when the new role
still confers manage). Guarding revoke but not downgrade would leave the invariant reachable
through the back door.

*A third lever removes manage without touching any grant row: the permission set itself.* A custom
set that confers `OBJ_MANAGE_ACCESS` can be **edited** to drop that permission, or **deleted** — on
delete its grants fall back to the view-only default (`acls.role_id` `ON DELETE SET NULL`). Either
change strips manage from *every* grant carrying the set at once, so a set that is the sole manager
path to a creatorless object strands it just as a revoke would, reached through the role instead of
the grant. The permission-set edit and delete mutations therefore consult a role-scoped guard,
`would_strand_manager_by_role`, before the change lands: for each object whose only id-scoped
manager grant runs through this set, it asks whether a durable manager survives the set losing
manage (a live creator, another id-scoped manager on a *different* set, or a type-wide `all`
manager) and refuses if none does. It is inert unless the set currently confers manage — a
view/edit-only set removes no manage authority, so deleting an ordinary role stays cheap and
unblocked, and the guard never false-positives on it. Built-in sets cannot be edited or deleted, so
only custom manager sets reach here.

*What counts as remaining coverage is deliberately narrow.* A live creator, another id-scoped
manager, or a type-wide (`all`) manager count — each is a **durable** manager path that a
non-admin cannot quietly remove. A **tag** manager grant does *not* count. The reason is that a
tag grant's reach is object-manager-mutable — a manager can drop the object's tag and sever it —
so it is not a durable manager path. This is why manage is kept off the tag selector entirely
(**F4**): a tag grant confers view/edit only, so a manage-conferring tag grant cannot be
authored, and even a seeded one is not honored for manage. That closes the one-step strand a
tag-only manager would otherwise have (drop your own tag), at its source. Excluding tag grants
from the survivor set here is then belt-and-suspenders: the survivor set only ever counts durable
manage paths.

**Test / guardrail:** a non-admin manager cannot remove the final non-admin manager grant from a
creatorless object — by revoke *or* by downgrade, through **either** the GraphQL mutations or the
REST access routes. Nor can an admin strip the last manager by **editing or deleting the
permission set** that carries it. A live creator, another id-scoped manager, or a type-wide manager
count as remaining coverage; a tag manager grant does not (and cannot be created).

**Status:** Holds across all three levers. The two per-grant paths — `revoke_access` / `grant_access`
(GraphQL) and `delete_access_grant` / `create_access_grant` (REST v1) — consult one shared
predicate, `phoenix.server.access.would_strand_last_manager`, on delete and on in-place downgrade
(covered by `TestRevokeKeepsAManager`, `TestDowngradePreservesManager`,
`TestTagManagerNotCountedAsSurvivor`, and `TestRestLastManagerGuard`). The role lever —
`patch_permission_set` (dropping manage) and `delete_permission_set` — consults the sibling
predicate `would_strand_manager_by_role`, covered by `TestStrandByPermissionSet` (strands /
another-id-manager-safe / type-wide-safe / creator-safe / non-manager-role-short-circuits) on both
engines.

## B4. Subject kinds are fully wired or rejected

### Story: The service account that silently cannot read

An operator wants a CI service account to read one dataset. They see `service_account` in the
subject vocabulary and script a grant to it. The row stores successfully, but the CI job still
gets not-found: request-subject resolution never matches `service_account` grants. Fail-closed,
so it is *safe* — but it looks like a feature that works, and the operator burns hours before
discovering the subject kind is only half-wired.

**Principle:** the vocabulary a system accepts must equal the vocabulary it honors; a name it
will store but not enforce is a false promise, so partial support fails loudly, not silently.

**Invariant:** a subject kind is supported only if it is matched by *both* the point check
(Python) and the SQL list predicate — and, if accepted at write time, resolvable in the audit
view.

**Requirement:** keep the subject enum, grant-write validation, request-subject resolution, SQL
predicate generation, and `subjects_for` in lockstep. An unimplemented kind must be rejected at
grant-write time, loudly, rather than stored inert.

**Test / guardrail:** every accepted subject kind has parity tests across `can_access`,
`accessible_scope`, `access_predicate`, and `subjects_for`. Unsupported kinds fail before a row
is written.

**Status:** Partial — the exposed write APIs already fail closed: the GraphQL subject input offers
only `user`/`group`/`everyone` (no service-account option), and the REST route rejects a
`service_account` subject at write time (422, "reserved but not yet supported"). The residual gap
is one level down: `SERVICE_ACCOUNT` still exists in the storage/subject vocabulary and is matched
by neither access path, so a row inserted out-of-band (seed/migration) would be stored inert. The
lockstep requirement is met at the API boundary; closing it fully means either wiring the kind end
to end or removing it from the enum until it is.

## B5. Subject membership has a defined freshness boundary

### Story: Removing Devin from Okta does not empty the cached session

Devin belongs to the `fraud-team` group through an external identity provider. An admin removes
Devin from that group in the IdP. Locally managed group changes take effect on the next request —
membership is recomputed live — but external group membership is synced at *login*, so Devin's
existing session can keep the old group-derived authority until the session refreshes or is
revoked.

**Principle:** every cached authorization fact needs a stated freshness bound, and the bound
must be explicit wherever authority is derived across a trust boundary such as an external IdP.

**Invariant:** subject membership has a stated freshness boundary, and it may differ for locally
managed vs. externally synced subjects.

**Requirement:** the product must state when external group and role changes take effect — next
authorization decision, next token refresh, next login, or explicit revocation — and
deprovisioning / incident-response docs must not promise immediate removal of externally-synced
group access unless the session is also invalidated.

**Test / guardrail:** removing a user from a locally managed group changes effective access on
the next request; removing them from an externally synced group follows the documented boundary,
and stale sessions do not outlive it.

**Status:** Gap — external group membership is login-time; the freshness boundary is undocumented
and unbounded within a session.

---

# Part C — The grant algebra (allow-only, monotonic)

## C1. Grants are additive, not ceilings

### Story: Alice is "set to Viewer" but still manages through her team

Alice has a direct viewer grant on a dataset and also belongs to a group with manager access to
it. Changing Alice's direct row to viewer does not cap her effective access — the group edge
still contributes manager authority, and in an allow-only model the union wins. Re-granting the
*same* edge does overwrite that edge's role (a per-edge downgrade is real), but it is not a
ceiling over other subject paths. Broad subjects are also live: grant `MEMBER` view on a dataset
and a later `VIEWER`→`MEMBER` promotion silently picks it up.

This is not a bug. It is the price of monotonic grants (see [design notes](./phoenix-access-control.md)
§2.13: only subtraction conflicts, and there is no subtraction).

**Principle:** grants are allow-only and monotonic — the model only ever adds authority, and
absence is the only "no." (The design's core commitment; see §2.13.)

**Invariant:** editing one grant edge changes that edge only. The model expresses no "at most,"
no per-object exception to an `everyone` grant, and no "Alice at most viewer regardless of
group." Those are new subtractive operators, not different button labels. Broad subject grants
evaluate against live membership.

**Requirement:** UI and API language must not imply a per-user downgrade caps effective access,
and must distinguish "direct grant" from "effective access." Role- and group-subject grants must
be labeled dynamic, with explanations naming the source (direct vs. role vs. group).

**Test / guardrail:** effective-access explanation for Alice shows both the direct viewer row and
the group manager row and reports the manager result. Promoting a user into a role that holds a
grant changes their access on the next decision, with the role named as the source.

**Status:** Holds — the intended allow-only behavior (covered by `TestMonotonicGrants`). The
residual risk is UI copy that implies a ceiling the model cannot express.

## C2. Object identity is `(type, id)`, never `id` alone

### Story: A wildcard grant leaks through a reused row number

An operator writes a seed grant for "object 5" and reaches for `object_type='*'` for
convenience, meaning dataset 5. But ids are scoped per table, so project 5 also exists: a
wildcard type paired with a concrete id aliases every unrelated object that shares the integer.

**Principle:** an object's identity is its full composite key, never a fragment; reasoning about
an id without its type conflates unrelated objects.

**Invariant:** a concrete object grant names a composite identity `(object_type, object_id)`.
Wildcard type is meaningful only for type-wide grants.

**Requirement:** `selector='ids'` requires a concrete `object_type`; `object_type='*'` is valid
only with `selector='all'` and a null `object_id`. Enforce with a database constraint or
write-time validation, not convention — the mutation API never produces the bad shape, so the
exposure is hand-seeded and migrated rows.

**Test / guardrail:** writing `object_type='*'` with `selector='ids'` fails; type-wide `*` / `all`
grants continue to behave as deliberate deployment-wide grants.

**Status:** Holds — a `CHECK (object_type != '*' OR selector_kind = 'all')` on `acls` makes the
shape unrepresentable (covered by `TestWildcardTypeConstraint`).

## C3. Permission sets preserve visibility

### Story: Quinn can edit a thing they cannot see

Quinn receives a custom permission set with `OBJ_EDIT` but not `OBJ_VIEW`. A point edit check
passes, but the object never appears in Quinn's lists and a view check fails — the oracle checks
each permission independently, so nothing forces the intended rule that a stronger object
capability implies visibility. Built-in sets obey the rule; custom sets can violate it. The
related trap: emptying a custom set does not revoke — it falls back to view-only.

**Principle:** capabilities are hierarchical — a stronger power implies the weaker ones it builds
on, so you can never act on what you cannot see.

**Invariant:** every object permission stronger than view is visibility-implying; an emptied set
has an explicit, documented meaning.

**Requirement:** permission-set creation/update rejects sets where `OBJ_EDIT` /
`OBJ_MANAGE_ACCESS` appear without `OBJ_VIEW`. An empty set is either invalid or a named viewer
set — never a silent drift that surprises its author.

**Test / guardrail:** custom sets cannot be saved in edit-without-view form; empty sets either
fail validation or resolve to the documented default consistently.

**Status:** Gap — the invariant is documented in the permission vocabulary but not enforced at
write time; custom sets can reach edit-without-view.

## C4. Manage-access is powerful but object-scoped

### Story: A manager can make co-managers

Sam holds manage-access on one dataset. Sam can grant another user manager on that dataset, and —
if the product allows broad subjects — expose it to a group or `everyone`. Sam cannot use that
authority to grant on a *different* dataset. Powerful within one object, not a pivot to the rest
of the system. The blast radius is still real: an `everyone` grant exposes the object to every
authenticated subject, and the allow-only model has no per-user carve-out below it.

**Principle:** least privilege through delegation — a delegated capability is bounded to its
object and must never be a pivot to broader authority.

**Invariant:** `OBJ_MANAGE_ACCESS` delegates access administration only on the resolved target
object.

**Requirement:** grant/revoke mutations resolve the target first, check manage-access on that
exact object, and write only grants for that exact object. Broad subjects such as `everyone`, if
allowed, are explicit in UI and audit log.

**Test / guardrail:** a manager of X can grant on X and cannot grant on Y. An `everyone` grant on
X affects X only, cannot be narrowed for one user without revoking the broad grant, and is
visible in effective-access explanation.

**Status:** Holds by construction — the manage check re-resolves the target object on every call,
so there is no cross-object pivot (enforced by the mutation shape, not yet a dedicated test).

## C5. Type-wide grants are administrative policy

### Story: Tess grants all datasets

Tess manages one dataset and can share it. She must not be able to grant "all datasets" to a
group, because that reaches creator-private datasets owned by other people. A type-wide grant is
not a bigger object share; it is deployment-level policy, and its authoring authority must
differ accordingly.

**Principle:** authoring authority must scale with blast radius; a deployment-wide grant is an
administrative act, different in kind from sharing one object.

**Invariant:** type-wide (`selector='all'`) grants are administrative actions. Object managers
administer the object they manage, not the whole type.

**Requirement:** `all` grants stay admin-only, visually distinct from per-object grants, and
audited as broad policy. If a future role may author type-wide grants, name that role
explicitly rather than inferring it from object-level `OBJ_MANAGE_ACCESS`. UI must state that
"all datasets" includes other users' creator-private datasets unless a narrower selector exists.

**Test / guardrail:** a non-admin manager of D can grant on D and cannot create an "all datasets"
grant; admin-created type-wide grants appear separately in access lists and explanations.

**Status:** Holds — but by two different mechanisms, worth stating precisely. The **GraphQL**
mutation only ever writes id-scoped grants, so it cannot author an `all` grant at all. The **REST**
`create_access_grant` *can* author a type-wide grant (omit `object_id`), and gates that branch on an
explicit `require_admin` — so `all` grants remain admin-only there too, but by an authorization
check, not by the write shape. The invariant (type-wide is administrative) holds on both; the
earlier "the mutation API only writes id-scoped grants" was true only of GraphQL. Watch item: any
*future* authoring path must likewise gate `all` to admins rather than infer it from object-level
`OBJ_MANAGE_ACCESS`.

---

# Part D — Propagation through parents

## D1. Parent-derived access is explicit and bounded

### Story: Carla expects access to cascade forever

Carla can read a dataset. Its experiments write traces to derived plumbing projects, and Carla
can read those because their access is rooted at the dataset. But that inheritance is one
explicit edge, not a recursive graph walk: the dataset grant does not make every future child,
grandchild, or downstream project reachable. The boundedness is a feature — it keeps the query
shape explainable and prevents accidental access expansion through a deep resource tree.
Revocation follows the same edge: revoke the dataset access and the derived project access
disappears with it (nothing is stored to dangle).

**Principle:** access reaches only along explicitly declared edges; it must never emerge as an
unbounded transitive closure over a resource graph.

**Invariant:** access-by-parent is a named containment rule (dataset → its direct
experiment/evaluator trace projects), not a transitive closure.

**Requirement:** each inherited edge is explicit in the oracle and in the list predicate. A new
derived resource states its parent edge, its permission mapping (D2), and its stopping point.

**Test / guardrail:** dataset access reaches the intended trace projects and no deeper or
unrelated project; list and point check agree; revoking the parent removes the derived access.

**Status:** Holds — one hop, computed live from the parent, never stored (covered by
`TestAccessByParent` and the list/point parity test).

## D2. Parent-derived access carries an explicit permission mapping

### Story: Edit on the parent edits more than people picture

Access-by-parent is currently computed at the *same* permission level as the parent, by reusing
the permission argument. So edit authority on a dataset also confers edit on its derived trace
projects. That may be the right policy — but it must be a deliberate mapping, not an accidental
consequence of passing one argument through.

**Principle:** every propagation of authority is a deliberate policy choice; a permission mapping
is decided, never inherited by accident of implementation.

**Invariant:** every access-by-parent edge has an explicit permission mapping.

**Requirement:** for each edge, state whether `view` / `edit` / `manage` propagate unchanged,
narrow to view, or require their own parent action.

**Test / guardrail:** each permission level on a dataset is tested against its derived resources,
including at least one negative case.

**Status:** Gap — the same-level propagation is real but implicit; whether it is the intended
mapping is undecided.

---

# Part E — The credential and ingest boundary

*This family is the most Phoenix-specific and the least built. It follows from Phoenix's dual
nature — a UI/API plane and a high-volume telemetry-ingest plane — and from the design's SYSTEM
superuser and auto-created projects (see [design notes](./phoenix-access-control.md) §2). Read
these as the boundary the design must hold as it grows, not as shipped behavior — with one
exception: E2's read/ingest separation already holds today by construction (the ingest paths
simply do not consult the read oracle).*

## E1. Credential scope is a protocol-boundary cap

### Story: The ingest key is allowed through one door only

Nora mints an ingest-scoped API key for a collector. It may send OTLP traces. It must not call
GraphQL, administer access through REST, or open a websocket. The scope is *attenuation*: it
narrows the owner's live authority before route code does any resource work — the `∩
credential-scope` cap of the reference model, and the one cap that binds even an admin. If a
single protocol boundary forgets the check, the key becomes larger than the scope printed on it.

**Principle:** a credential carries no more authority than the scope it was minted with, and that
cap must bind at every entry point before any application logic runs.

**Invariant:** API-key scope is enforced at every protocol boundary before application handlers
run; unknown scope values fail closed.

**Requirement:** HTTP, websocket, and gRPC entry points share one scope vocabulary and one
fail-closed posture. New ingest routes are added to the allowlist deliberately; new non-ingest
routes deny scoped ingest keys by default.

**Test / guardrail:** an ingest-scoped key uses every intended ingest endpoint and cannot use
GraphQL, non-ingest REST, or websockets; an unknown scope value is denied everywhere.

**Status:** Proposed — a `scope` column exists on API keys; uniform enforcement across every
boundary is target-state.

## E2. Ingest authority is separate from read visibility

### Story: The collector can write a project nobody can read

A collector posts spans for a new project `production`. The project is born from ingest, not a
user clicking "create," and under the fail-closed model it may be admin-only until a human grants
read. But ingest must continue — a project read grant is not what authorizes the collector to
write telemetry. The reverse holds too: an ingest credential may append to a project without
gaining GraphQL read of the spans it wrote.

**Principle:** producing data and consuming it are distinct capabilities; the authority to write
telemetry and the authority to read it are separate decisions, and neither implies the other.

**Invariant:** project read visibility and ingest write authority are different decisions.
Project grants gate read and object administration; ingest writes are governed by credential
capability, protocol scope, and ingest-route policy.

**Requirement:** read predicates must not be inserted into ingest paths as accidental write
gates, and read-only/UI credentials must not become ingest-capable just by being able to read a
project. Any future project-level ingest restriction is named as a new ingest authorization rule,
not smuggled through read visibility.

**Test / guardrail:** with access control on, an ingest credential writes the intended project
even when no non-admin has a read grant; a read-only credential cannot write spans through the
ingest protocol.

**Status:** Holds — evidenced by the current code: the trace/span ingest routers do not invoke
the read oracle, so the two planes are separate code paths today. Recorded here as a guard so a
future change does not couple them. Several *requirements* above (denying ingest to read-only
credentials; naming any future project-level ingest rule) remain Proposed.

## E3. Copies across access roots are authorization events

### Story: Riley copies spans into a dataset

Riley can edit a creator-private dataset but **cannot read** project P. Riley runs "create
examples from spans," pointing at P's spans. If the copy checks only Riley's write access to the
*target* dataset, Riley pulls data out of a project they were never allowed to read and launders
it into a dataset they own — then shares or exports it under the dataset's policy. The source
graph was not mutated, but the data crossed an access boundary, and that is an authorization
event. (Even a source Riley *can* read may warrant a distinct export/manage action for
high-sensitivity copies.)

**Principle:** data carries its source's access policy across boundaries; moving it from one
access root to another requires authority on both sides, not just the destination.

**Invariant:** copying data from one access root to another requires authority on both sides;
source read is the minimum, and high-sensitivity copy/export may require a distinct action.

**Requirement:** dataset-from-spans, prompt clone, trace transfer, and any future
"materialize from selected data" feature state the source *and* target action they require. A
target write check alone is insufficient when the bytes came from a separately protected root.

**Test / guardrail:** a user who can edit dataset D but cannot read project P cannot create
examples in D from spans in P; a user with both can, and lineage is recorded if the product uses
it for audit or downstream grants.

**Status:** Gap/Proposed — cross-root copy paths are not known to check the source root today.

## E4. Hidden plumbing names are not authorization

### Story: The hidden experiment name is not a password

An SDK-run experiment gets a server-minted project name like `Experiment-<hex>` and uses it to
upload that run's traces. The name is hard to guess, but it is a *routing* identifier, not a
credential. If possession of the name is enough to write forever, a log line, notebook, or
forwarded config becomes a reusable write capability for hidden plumbing data.

**Principle:** a routing identifier is not a credential — secrecy of a name is not access
control; authority must rest on a verifiable, revocable capability bound to the actor.

**Invariant:** server-minted plumbing identifiers do not replace authorization. Possession of a
hidden name may *route* a write, but the write must still be tied to the actor, credential, or
parent run.

**Requirement:** experiment/evaluator trace writes are bound to a scoped, revocable authorization
for the parent run (or an equivalent server-side proof the writer acts for that run). The
concrete mechanism is a design decision — see [design notes](./phoenix-access-control.md) §2; if
a hidden name remains usable, treat it as secret-bearing and make its use auditable.

**Test / guardrail:** knowing the hidden project name alone is not sufficient to append traces
outside the authorized run context; completing or revoking the parent run closes the write path
unless the product explicitly keeps it open.

**Status:** Proposed — the run-scoped write authorization is not built; this records the invariant,
not the mechanism.

---

# Part F — Attribute-based (tag) access

*The design notes ([§2.11](./phoenix-access-control.md)) scope out attribute-based access at the
coarse, project-level grain and name curated-tag ABAC only as the fine-grain hybrid a future
sub-resource requirement would add. That hybrid has been prototyped as an **additive grant
selector**: a grant can address `selector_kind='tag'`, reaching every object of its type that
carries a curated `key=value` tag (stored in `resource_tags`). It changes nothing until an admin
both tags an object and authors a tag grant. These invariants govern that layer; they do not
revisit the §2.11 verdict, which stands for coarse-grain access.*

## F1. Tag access resolves identically in the scope and predicate paths

### Story: The tag grant that matched everything

A tag grant is authored for "datasets tagged `env=prod`." The point/scope path (Python, which
materializes ids) correctly returns just the prod dataset. The list path (a SQL `WHERE` predicate)
returns *every* dataset — because its tag-existence subquery, nested two levels under the object
query, re-added the object table to its own `FROM` instead of correlating the outer one, turning a
filter into a cross join. Two code paths answering the same question diverged, and only one was
right. A parity test caught it; without one, list views would silently over-grant.

**Principle:** the same access question answered two ways must return the same answer; any selector
that lives in both the materialized-scope path and the SQL predicate path is only as correct as the
agreement between them.

**Invariant:** for every selector — `ids`, `all`, and `tag` — `can_access(x)` ⟺ `x ∈ list(predicate)`.
A tag grant contributes the *enumerated ids* of the objects currently carrying its tag on both
paths, never a type-wide allow.

**Requirement:** the tag branch is added to both `accessible_scope`/`_granted_scope` and
`access_predicate`/`_access_predicate_for_user`, hand-kept in lockstep. The SQL tag-existence
subquery must correlate the outer object column (`correlate_except` on the `resource_tags` alias),
not re-select the object table. A parity test over tag grants runs on **both** engines. (Longer
term, factor the "grant confers permission and matches object" test into one shared builder so the
two paths cannot drift; noted, not done.)

**Test / guardrail:** `TestTagGrants` asserts scope/predicate parity across object types and
permission levels on SQLite and Postgres, including the containment case (a tag grant on a dataset
reaching its derived trace projects through D1).

**Status:** Holds — both paths learn the tag selector; the correlation fix is in and parity-tested
on both engines.

## F2. Tag matching is exact and engine-identical

### Story: `Prod` and `prod` quietly diverge

An admin tags one dataset `env=Prod` and another `env=prod`, then grants on `env=prod`. If matching
were case-insensitive on one engine and not the other — or via `LIKE`/regex whose semantics differ
between SQLite and Postgres — the same grant would reach different objects depending on where it ran.
Access would depend on the database, not the policy.

**Principle:** an access decision must not depend on database-specific string semantics; a
two-engine product can only rely on comparisons that mean the same thing everywhere.

**Invariant:** tag matching is exact equality on `(key, value)` — no `LIKE`, no regex, no
case-folding, no collation-dependent comparison.

**Requirement:** both oracle paths compare `key` and `value` with `==` only. If case-insensitive or
fuzzy matching is ever wanted, normalize values **on write** (one canonical form stored) rather than
matching loosely at read time. Any such normalization is itself an access-affecting decision and
stated explicitly.

**Test / guardrail:** a grant on `env=prod` does not reach an object tagged `env=Prod`; the portability
suite runs tag tests identically on both engines.

**Status:** Holds — exact-match only, exercised on SQLite and Postgres.

## F3. Tag grants are type-scoped, never cross-type

### Story: The "everything tagged prod" grant that has no home

An admin wants "everything tagged `env=prod`, regardless of type." Expressed as `object_type='*'`
with a tag selector, that grant would pair a wildcard type with a non-`all` selector — the exact
combination **C2** forbids, because object identity is `(type, id)` and a wildcard type is only
coherent with the type-wide `all` selector. A cross-type tag grant has no coherent storage under the
current constraint.

**Principle:** a mechanism must not smuggle in a shape the identity model already ruled out; a tag
grant is still a grant and obeys the `(type, id)` identity rule.

**Invariant:** a tag grant always carries a concrete `object_type` (`project` / `dataset` / `prompt`)
with `object_id` NULL. It never uses `object_type='*'`. This keeps the `wildcard_type_requires_all_selector`
CHECK satisfied for free (the type is not `'*'`), and matching is scoped within one type.

**Requirement:** the tag-grant mutation only ever writes a concrete type. Folding objects across
types is done by authoring one type-scoped tag grant per type. Bringing cross-type tag grants into
scope is a deliberate future step that must widen the CHECK to `selector_kind IN ('all', 'tag')`
(table rebuild on SQLite, `DROP/ADD CONSTRAINT` on Postgres) — not an accident of a `'*'` slipping
through.

**Test / guardrail:** a tag grant scoped to `dataset` reaches only datasets, never a same-tagged
project or prompt; the wildcard CHECK still rejects `('*', 'ids'|'tag')`.

**Status:** Holds — the mutation is type-scoped by construction; cross-type is explicitly out of
scope and the CHECK is unchanged.

## F4. Tags are curated authority, gated like the grants they feed

### Story: The ingest pipeline that tagged its way in

If a tag can be set by anyone — or worse, derived from client telemetry — then whoever writes tags
writes access, because a tag grant turns `env=prod` into "who can reach prod." An ingest pipeline
labelling its own spans could then widen access without ever touching a grant. Tags that steer
access must be as privileged as the grants that read them.

**Principle:** anything that changes who can reach an object is an authorization action and carries
authorization's authority requirements; a tag is not metadata when a grant reads it as policy.

**Invariant:** setting or removing a tag on an object requires `OBJ_MANAGE_ACCESS` on that object —
the same authority as granting access to it. Authoring or revoking a *tag grant* is admin-only,
because its blast radius is a whole type, not one object (the **C5** logic: authoring authority
scales with blast radius). Tags are server/admin-set, never client telemetry, and are kept distinct
from prompt version/commit labels — "which version" and "who can see it" are different controls and
namespaces.

*A tag grant confers view or edit, never manage-access.* Manage is delegation authority, and a
tag's reach is object-manager-mutable (setting/removing a tag needs only `OBJ_MANAGE_ACCESS`, which
a manage-conferring tag grant would itself hand out). A tag-only manager could then strand an
ownerless object in one step by removing its own tag — a direct **B3** violation. So manage is kept
off the tag selector at two layers: the oracle refuses to honor manage from a tag grant (both
paths), and `grantTagAccess` rejects a manage-conferring permission set at authoring time rather
than storing a grant that is silently inert for manage.

**Requirement:** `setResourceTag`/`removeResourceTag` gate on `OBJ_MANAGE_ACCESS` on the target;
`grantTagAccess`/`revokeTagAccess` gate on administrator. `grantTagAccess` rejects a permission set
that includes `OBJ_MANAGE_ACCESS`; the oracle's tag branch is omitted from any manage-permission
resolution. No new permission verb — tagging *is* managing access. The tag namespace is separate
from any content/label namespace.

**Test / guardrail:** a non-manager cannot set or remove a tag; a non-admin cannot author or revoke
a tag grant; a manage-conferring tag grant is rejected at authoring and never confers manage in the
oracle.

**Status:** Holds for the data effects, the no-manage rule, and the gating shape
(`TestResourceTagMutations`, `TestTagAccessGrantMutations`, and the oracle's
`test_tag_grant_never_confers_manage`). The admin/manager gates themselves are auth-enabled
integration territory, as elsewhere in this doc. **Gap:** a first-class *audit surface* that
enumerates tags and tag grants as access-affecting actions (beyond the stored `created_by` and the
`subjects_for` credit) is not built.

## F5. Tag rows have no foreign key — swept on delete, inert while dangling

### Story: The reused id that inherited a stranger's tags

A dataset is deleted; its numeric id is later reused by a new dataset. The `resource_tags` reference
is polymorphic `(object_type, object_id)` — no real FK to datasets, so no `ON DELETE CASCADE` fires
— and the old tag rows were never swept. The new dataset now carries a stranger's `env=prod` tag, and
any tag grant on `env=prod` silently reaches it. Absence of a FK made cleanup the application's job,
and the missed sweep became an access leak.

**Principle:** a polymorphic reference the database cannot cascade puts cascade-correctness on the
application; the delete path must do explicitly what a FK would have done by construction.

**Invariant:** an object's tags are removed on the same delete path, in the same transaction, as its
grants (`delete_object_tags` is the sibling of `delete_object_grants`). A tag on a non-existent object
is inert at read time regardless — the object cannot appear in the base query — but the sweep keeps
the table and the "tags of X" view honest and closes the id-reuse leak. Tag *grants* need no sweep:
they carry the `key`/`value` as strings, not a FK to a tag row, so a removed tag simply stops matching.

**Requirement:** every object-delete path that sweeps grants also sweeps tags. Read-time resolution
never assumes a tag's object exists; it matches only objects the base query already produced (fail
closed during any dangling window). New access-controlled types repeat both sweeps.

**Test / guardrail:** deleting an object removes its tag rows; a tag grant matching a since-deleted
object grants nothing; the sweep touches only the deleted object's tags, not a sibling's.

**Status:** Holds — `delete_object_tags` wired into all object-delete paths; inertness and
sweep-isolation covered by `TestTagGrants`.

---

## Summary

Tags: **[H]** holds today · **[G]** gap to close · **[P]** proposed / undecided.

**A — One decision, applied everywhere**
- **A1** The oracle owns final effective access, caps included. **[G]**
- **A2** Coverage is correctness: an oracle not called is no protection. **[G]**
- **A3** Denial is indistinguishable from absence; guards fail closed on missing ids. **[H/G]**
- **A4** Enforcement is a startup-latched, deployment-wide decision and presupposes auth. **[H/P]**

**B — Ownership and the subject lifecycle**
- **B1** Ownership is stored data: survives role change, dies with the identity. **[H/G]**
- **B2** Enforcement and audit share one ownership rule. **[G]**
- **B3** Creatorless objects need last-manager protection, across all three levers (revoke, downgrade, permission-set edit/delete). **[H]**
- **B4** Subject kinds are fully wired in point, list, and audit paths — or rejected. **[H/G]**
- **B5** Subject membership has a defined freshness boundary. **[G]**

**C — The grant algebra (allow-only)**
- **C1** Grants are additive; editing one edge is not a ceiling; broad subjects are live. **[H]**
- **C2** Object identity is `(type, id)`; wildcard type cannot pair with a concrete id. **[H]**
- **C3** Object permissions imply view; custom sets cannot be edit-without-view. **[G]**
- **C4** Manage-access is object-scoped; it delegates, it does not pivot. **[H]**
- **C5** Type-wide grants are administrative policy, not big object shares. **[H]**

**D — Propagation through parents**
- **D1** Parent-derived access is one explicit, bounded edge — no recursive inheritance. **[H]**
- **D2** Each parent edge carries an explicit permission mapping. **[G]**

**E — The credential and ingest boundary**
- **E1** Credential scope is a protocol-boundary cap, enforced before handlers run. **[P]**
- **E2** Ingest write authority is separate from project read visibility. **[H]**
- **E3** Copies across access roots require authority on both roots. **[G/P]**
- **E4** Hidden plumbing names route writes; they do not authorize them. **[P]**

**F — Attribute-based (tag) access** (additive selector; §2.11's fine-grain hybrid)
- **F1** Tag access resolves identically in the scope and SQL-predicate paths. **[H]**
- **F2** Tag matching is exact equality — no `LIKE`/regex/case-fold, engine-identical. **[H]**
- **F3** Tag grants are type-scoped, never cross-type (wildcard CHECK unchanged). **[H]**
- **F4** Tags are curated authority: set/remove is `OBJ_MANAGE_ACCESS`, tag grants admin-only and never confer manage. **[H/G]**
- **F5** Tag rows have no FK — swept on delete, inert while dangling. **[H]**
