# Phoenix Access Control: Design Notes

A Phoenix-specific companion to [access-control-survey.md](./access-control-survey.md).
The survey is anonymized and product-neutral — a shared vocabulary and mental model. This
document is the opposite: it records what is *peculiar to Phoenix* and the design
reasoning that follows.

**Terms imported from the survey** (read it for the full treatment): *subject / identity /
credential / grant*; the **single oracle** (one function answers every "can X do Y on Z?");
the **effective-access formula** (`authority(identity) ∩ attenuation(credential)`); the
**two families** — *Family A* (enumerated grants: rows you store and join) vs *Family B*
(attribute/predicate rules, "ABAC"); and group **Pattern 1** (a group is a first-class grant
subject) vs **Pattern 2** (a group maps to a role). "Survey §N" references point at that doc.

**Scope and status.** This is a *design document written against `main`*. The questions
in §2 are properties of Phoenix's domain and hold regardless of any implementation. Where
it refers to a concrete mechanism — an `acls` table, a single oracle, an attenuating
`scope` on API keys, a `subject_kind` discriminator, an access-control feature flag — that
is **the proposed direction (a prototype), not shipped code on `main`.** Such references
are named for concreteness and labeled as proposed; they are deliberately kept free of
file/line citations so the doc does not rot as the prototype moves.

A second distinction matters for the security-driving claims: some are **domain
assumptions this design relies on** (projects are auto-created on ingestion; a
deleted-then-re-ingested project gets a new id; SYSTEM is a hidden superuser) — stable
enough to build on, but **if any of them changes, revisit the affected sections**. Others
are **current-code observations** that are more likely to change and should be
**re-verified against the code before implementation** — chiefly that trace transfer
updates only `project_rowid` and leaves the session behind (§2.9); that `session_id`
was resolved globally before the composite-unique fix (§3.3); and the §2.8
system-generated-project facts (the shared `playground` singleton, the hidden
`Experiment-<hex>` / `dataset-evaluator-<hex>` projects, the `exclude_*` list filters,
parent-`user_id` ownership, and the client-vs-server experiment execution paths); and the
§6 global-object facts (the `secrets` store, the evaluator / annotation-config / model /
label library, retention policies, system settings). These were verified against `main`
(as of 2026-06), but the doc cites no line numbers, so re-verify against current code
before building on them. Where this doc draws a security conclusion from either kind, treat
the conclusion as sound but the code detail as "verify current behavior first."

A third provenance applies narrowly to §2.8's **online-eval** material: it is drawn from a
**separate, concurrent design effort** (targeting the same release) — neither `main` nor this
prototype — so its specifics (a production project as the data context, where the judge's own
trace lands) are *proposed shape*, not observed behavior, and should be reconciled with that
workstream as it lands.

If you only read one thing: **most RBAC designs assume a person creates a resource and
becomes its owner. Phoenix's highest-volume resources are created by a telemetry
pipeline, not a user** — and every tension in §2 is a consequence of that fact.

**Tenancy is in scope as a structural direction, not as a full design.** This doc's spine
is per-resource access control — *who can see this project*. But per-resource grants can
hide Team B's `production` from Team A and still cannot give each team its *own*
`production`, namespace ingest routing, or stop write-time existence leaks ("name already
exists"). That gap — **tenancy / namespace isolation** — is the structural fix for the
deepest tensions in this doc, so it is treated as a named direction in **§5** rather than
deferred. What §5 does *not* attempt is the full tenancy design (org model, provisioning,
migration mechanics); that remains a follow-on. (One piece that *isn't* tenancy-shaped —
a blocked producer creating a new visible project under a different name — is covered as
ingestion-time creation authority in §2.2.)

---

## 1. The strawman (and the analysis behind it)

**Proposed strawman** — here *strawman* means a deliberate, conservative **starting
proposal** to anchor discussion (not an argument set up to be knocked down). It is
fail-closed and easy to relax:

- **Flag off → no change** (everything open, exactly as `main` behaves today).
- **Flag on:**
  - **Ingest-born projects** (no human creator) default to **admin-only**: visible to
    administrators and to whoever is explicitly granted, nobody else. Ingestion stays
    **unimpeded** — any **ingest-capable** credential may create/write any project, and
    project-level grants do not gate ingest. (API-key *scopes* still apply: this does not turn
    a read-only or UI credential into an ingest credential — only *project*-level read-gating
    is lifted, not credential attenuation, §2.5.) Only *read visibility* is gated by grants.
    (Read-safe, but *operationally* abusable — any ingest-capable credential can spawn
    unbounded invisible projects; see §2.2.)
  - **User-created resources** (datasets, prompts) default to **creator-private** (creator +
    admins).
  - **Administrators retain visibility to everything; only admins delete projects.**
  - **Read visibility** is **monotonic allow-only** — grants only ever *add*. There is no
    everyone-baseline to shadow, so no non-monotonic resolution, no `restricted` marker, no
    last-grant footgun. The default mechanism is **hand-written group grants** applied *after*
    birth (admins triage the admin-only project and grant a group); creator-private resources
    (datasets, prompts) instead **auto-grant their creator at creation**.

  *Scope — "access" here means **read visibility**, and the verbs are governed separately:*
  reads are gated by grants (above); **ingest writes** are *ungated*; **delete** is
  admin-only; and **other project-lifecycle actions** (rename, settings, retention,
  manage-access, and any archive/restore) are separate **manage/admin** actions,
  admin-by-default until specified. So "can write any project" is *ingest*, not all writes —
  don't read the monotonic-grant rule as governing every verb.

*Why this is the right strawman:* for a *security* feature, being too restrictive fails more
safely *for confidentiality* — the cost is access friction (ask an admin), up to a planned
non-admin cutover at the flip (§2.1, §3.5), but no data escapes — while being too open is a
leak you can't take back. So fail-closed is the safe anchor, and you iterate *from* it by
**adding** grants (safe), never by removing exposure (risky).
It is the simplest model available, positioned so the discussion *relaxes* it, not tightens
it.

*Two costs, stated up front:* (1) the flag flip is a **hard cutover, not a no-op** —
enabling it locks non-admins out of ungranted projects until grants are written (flag-*off*
is unchanged); the §3.9 dry-run and communication manage it. (2) **Admin/creator is in the
loop for the default case** — fine at low project churn (one group grant at birth), but a
genuine **support cliff at high project counts**, because "ask an admin" is only benign if
admins can *identify which team owns which project* and pre-write grants. So a
**grant-authoring + project-ownership-identification workflow is a launch prerequisite**, not
an afterthought — and it is the pressure that justifies the churn-driven escalations
(credential-derived auto-grants, then tenancy, §5). Those escalations are deliberately
**not** baked into the strawman — they are the evolution paths the discussion should pull
in, not pre-decided parts of it.

*Considered and rejected for the strawman:* an **everyone-allow baseline + shadowing** (the
gentler, no-op-on-flip alternative) — rejected as fail-*open* and non-monotonic (it is the
source of the shadowing / `restricted`-marker / last-grant complexity discussed in §2.1);
**ABAC / tags** (§2.11 — and worse than hand group-grants); **tenancy** (§5 — churn-driven,
not day-one).

*How to read the rest:* §2 is the *analysis that produced this strawman* — each section is
the reasoning behind a choice above, with the rejected everyone-allow model kept for the
record. §3 is the implementation work the strawman still needs (coverage above all). **§6**
(global objects) is orthogonal. **§5** (tenancy) is the *structural direction* — out of
prototype scope, but not irrelevant: it is the structural fix for the birth tensions
(§2.1/§2.3/§2.4).

The shape of the problem, in one line:

> Phoenix's RBAC problem is not "how do users share objects?" It is **"how does an
> unattended telemetry pipeline safely create, route, and continue writing resources whose
> visibility may later narrow?"** Everything else follows from that: fail-closed cutover
> migration, creation authority, machine credentials, containment integrity, and coverage
> across derived read surfaces.

A project is auto-created the first time a span carrying its name is ingested. There is
no interactive, authenticated user clicking "New Project," and the same is true of the
spans, traces, and sessions underneath it. The surveyed vendors mostly assume UI-driven
creation, where the creator is a known user who naturally becomes the owner. Phoenix's
dominant creation path is a collector posting OTLP — no user, often no human-scoped
credential at all. This is true on `main` today, and the vendors get to lean on "creator
owns it" where Phoenix cannot, for its most common resource.

The high-level conclusions that follow, each developed in §2–§3:

- **It is an ingestion problem, not a sharing-dialog problem.** Most RBAC products start
  from "a user creates a resource, then shares it"; Phoenix starts from "a machine creates
  a resource by writing telemetry." That flips the hard questions away from grant-authoring
  UI toward creation authority, default visibility, machine credentials, and ingestion
  failure modes (the *Birth and creation* and *Identity and authority* groups of §2).

- **One rooting principle, not a taxonomy of resource kinds: root each resource's access at
  its real data context.** For trace-bearing, project-contained data the principle yields two
  common access roots — the **telemetry world** (machine-created projects, ownerless →
  admin-only) and the **dataset world** (human-created datasets/prompts → creator-owned).
  Everything else — experiment traces, evaluator traces, online-eval scores — is a
  **run-artifact rooted at the data context it evaluates** (a dataset offline, a production
  project online), not a third kind of project. "Project" is just the span store, reused
  (§2.8). And the principle, not the pair, decides the cases the two common roots don't
  cover: playground's data context is the user who ran it (per-user scratch, §2.8), and
  deployment-global objects that hang off **no** project — secrets, the shared
  evaluator/model/label library, system config — have no data context to root at, so they get
  their own treatment in §6.

- **Birth-time policy matters more than after-the-fact sharing.** When resources are
  created unattended, the decision made *at creation* — visible, invisible, or routed
  somewhere surprising — is the primary control. Grants written later are remediation, not
  the main mechanism (§2.1, §2.2).

- **Visibility isolation and namespace isolation are different products — and tenancy is
  the structural fix.** Per-resource grants can hide Team B's project from Team A, but
  cannot give both teams a project named `production` or disambiguate ingest routing. That
  is a *separate layer*, namespace/tenancy — and it is also the structural resolution of the
  hardest tensions below: a container above `project` is what gives an ownerless,
  machine-created resource something to inherit. It is the recommended direction (§5), not
  a footnote — though a two-sided one: it ameliorates the birth pains and exacerbates the
  operational ones. Crucially, the per-resource RBAC proposed here **ships and stands on its
  own without tenancy**; tenancy is a later structural change to the preferred *defaults and
  creation model*, not a prerequisite — this is not "don't build RBAC until tenancy."

- **Fail-closed and monotonic is the default — not an open baseline.** The everyone-allow
  alternative leans on a baseline + shadowing so the flag flip is a no-op; the
  strawman rejects it (§2.1) for **admin-only-default**, whose **read visibility** is
  **monotonic allow-only** — grants only *add*, so the shadowing apparatus, the `restricted`
  marker, and the
  last-grant-reopen footgun all disappear. The price is a hard-cutover flip rather than a
  no-op — the deliberate fail-closed trade (§2.1, §3.5).

- **Machine identity is the center of least privilege.** Human-owned API keys are tolerable
  as a first step, especially with attenuation, but every serious rollout pressure —
  continuity across offboarding, honest audit, scoped credentials, stable ownership of
  ingestion — points toward first-class service accounts (§2.5).

- **The hardest implementation work is coverage, not schema.** The ACL table and oracle are
  small; the real work is making every list, count, aggregate, export, subscription,
  dashboard, ingest path, and transfer apply the *same* predicate (§3.7). The write side has
  the same hazard in sharper form: the *same* operation must resolve to the *same*
  authorization answer regardless of which API surface it arrives on. Authorization placed as
  per-route/per-resolver decorators drifts — project mutations diverged, with REST reserving
  project delete/update for admins (`require_admin`) while the GraphQL resolvers let any
  non-viewer member run them: one operation, two answers, the stricter one bypassable by
  switching surfaces. A control you can route around that way is not enforcing what it appears
  to. Reconciling the two (here, tightening the GraphQL resolvers to admin-when-auth-on to
  match REST) is a hand-patch; the durable fix is a single shared gate, not a decorator
  re-applied per surface for each surface's assumed consumer.

- **Attribute-based access (ABAC) isn't needed for project-level access.** Phoenix's
  project-level access is plain enumeration — these teams see these projects — which ordinary
  grants handle directly; ABAC's "everything matching a rule" power solves a problem Phoenix
  doesn't have *there*. The one place a predicate could earn its keep is **sub-resource**
  scoping (e.g. a server-classified `pii=true` view, "only annotations I authored"), which is
  out of current scope — so the verdict is scoped, not absolute (§2.11).

### Open decisions

The strawman settles the default-visibility *model* (fail-closed admin-only, monotonic).
What remains open — to be argued, not assumed:

- **Ratify the hard-cutover flip?** The strawman's flip locks non-admins out of ungranted
  projects until granted (vs the rejected everyone-allow no-op). This is the headline trade
  to accept consciously (§2.1, §3.5).
- **Human-authored project creation** — when a person *explicitly* creates a project (a
  `POST /projects` call, opening a playground), the ingest-born admin-only default is wrong:
  it locks the creator out of what they just made (§2.3). The question is the posture for that
  explicit-create case, of which **playground** is one instance. Three options: (1) **status
  quo** — project-by-table, ownerless → admin-only (reject: the locked-out-creator footgun);
  (2) **intent-keyed** — explicit create auto-grants its creator, exactly as a dataset does,
  shrinking the ownerless case to *auto-vivification-on-ingest alone*; (3) **admin-only
  endpoint** — gate explicit project-create to admins, so a non-admin's only path to a project
  is ingest (→ admin-only) and the "created a project I can't see" state cannot arise (minimal
  surface, no new grant semantics). For playground specifically the lean is (2) — **per-user
  `kind=PLAYGROUND` projects auto-granted to the creator** (keeps access project-level, no
  sub-resource exception) over the shared-project + per-run-attribution alternative (§2.8).
  (Experiment/evaluator **access-by-parent** is *not* open — it is a settled invariant, because
  admin-only there is a straight bug.)
- **Service-account timing** — first-class non-human identities vs attenuated user keys
  (§2.5).
- **Global read-only cap vs. per-object lift (§2.13)** — does a global `VIEWER` *hard-cap*
  object write-roles (the current, **emergent** behavior — an object Manager grant to a VIEWER
  is visibility-only), or do object Editor/Manager grants *lift* the write-cap **for that
  object**? Lean **A (hard ceiling)** for an auditable read-only guarantee — but ratify it
  deliberately and document the footgun (object write-roles presuppose MEMBER+); reconsider
  **B** only if per-project write-delegation to otherwise-read-only users becomes a real need.
- **Churn-driven escalation timing** — when project churn justifies *credential-derived
  auto-grants* (a project auto-grants the team owning the key that created it, removing admin
  from the common case), and then the tenant layer (§5).
- **Ungated ingest integrity budget** — the strawman deliberately leaves project-level ingest
  writes open (§2.2). Ratify whether that means *any* ingest-capable credential may append to
  an existing private project by name, and if so which mitigation bounds the poisoning cost
  (the §2.2 menu).
- **Dataset copies from telemetry** — when a user creates a dataset from project spans/traces,
  is that a permitted copy of data they can read, or must the dataset inherit/check the source
  project's access (§2.9)? This is the copy-shaped analogue of trace transfer.
- **Hidden experiment project write authority** — client-initiated experiments write to a
  server-minted `Experiment-<hex>` target (§2.8). Decide whether the project name is treated as
  a bearer capability, or whether ingestion into `kind=EXPERIMENT` / `kind=EVALUATOR` projects
  requires a scoped, revocable authorization tied to the parent run.
- **Disable surface & break-glass (latch already built)** — the **DB-latched activation model
  is implemented** (one-way latch in `system_settings`, plus a drift guard and an auth guard
  that refuse to start on env/latch or auth mismatch; §3.5), so *enable-only* and
  *drift-immunity* are settled. **Open:** there is **no audited in-app disable and no
  break-glass surface** — disabling today is a raw out-of-band DB edit before startup. Decide the
  audited-disable UX and the break-glass escape (§3.5).
- **Revocation and audit floors** — grant changes should take effect on the next request unless
  an explicit cache budget says otherwise (§3.13); pre-existing API keys with nullable `scope`
  need a stated default at cutover (§2.10); and the initial ship needs a decision on the base
  action log, not only point-in-time effective-access history (§3.11).
- **Global-object policy** — secret value-vs-metadata, per-type read for the shared library,
  retention-write authority (§6).

*Settled by the strawman (not among the open items above):* the restricted-state model
(monotonic ⇒ no marker, no shadowing); per-type default visibility (projects admin-only,
datasets/prompts creator-private); ingestion-time creation authority (creation exposes
nothing, so ingestion stays ungated); and **access-by-parent for experiment/evaluator
projects** — a settled invariant, since making them admin-only hides a non-admin's own
results (§2.8).

### The verb model — what `can(subject, action, resource)` must express

The strawman pins down `read` and `ingest_write` precisely; the rest of the verb space was
left as "admin-by-default until specified," which is not enough to implement an oracle from.
The minimal verb enum and the per-type defaults under the flag:

| Verb | Meaning | Notes |
|------|---------|-------|
| `read` | View a resource and its contained data | The monotonic, grant-gated verb (§1). Inherited by containment children (§2.7). |
| `ingest_write` | Append telemetry to a project | **Not** gated by project grants (§2.2); still bounded by the credential's `scope` (§2.5). Creates the project if absent. |
| `annotate` | Create/edit user-authored sub-objects (annotations, labels, feedback) on readable data | A reader may create; *edit* is **author-scoped** (you edit your own), the sole sub-object exception (§2.7). Distinct from `read` — and distinct from `ingest_write`. |
| `manage` | Mutate a resource's own config/lifecycle (rename, settings, retention, transfer-out, manage-access) | Admin-by-default; a project-manage grant may delegate it **to a MEMBER+** — a global `VIEWER` is blocked by the read-only gate regardless of the grant (the §2.13 fork). Transfer-out needs `manage` on the *source* (§2.9). |
| `grant` | Change who has access to a resource | A security-load-bearing slice of `manage`, named separately so it can be audited/restricted on its own. |
| `delete` | Destroy a resource | **Admin-only** for projects (§1); creator+admin for datasets/prompts. |

Per-resource-type defaults under the flag (✓ = has it by default; *grant* = only via an explicit grant; *admin* = administrators only):

| Resource | `read` | `ingest_write` | `annotate` | `manage` / `grant` | `delete` |
|----------|--------|----------------|------------|--------------------|----------|
| Telemetry project | *grant* + admin | any ingest-scoped credential | reader; author-edit | admin | admin |
| Dataset / prompt | creator + *grant* + admin | n/a | creator + readers | creator + admin | creator + admin |
| Experiment / evaluator | **inherits parent dataset** (§2.8) | n/a (runner writes plumbing project) | via parent | via parent | via parent |
| Annotation (sub-object) | inherits project | n/a | author (+admin) | n/a | author (+admin) |
| Global objects (§6) | per-type (open) | n/a | n/a | admin (open) | admin |

This resolves the read-only-vs-write ambiguity directly: a **read-only grantee** has `read`
only — they may `annotate` (their own) but **cannot** `transfer` (that needs `manage` on the
source) and cannot perform any other `manage`/`delete` action. "Ingest is ungated" never
implies "non-ingest writes are ungated."

**Precedence — how the layers compose.** A subject's *authority* for `(action, resource)` is
the **union** of: (1) their **global role**'s baseline permissions (e.g. `ADMINISTER` ⇒ all
`read`/`delete`), (2) **object grants** naming them (or a group they're in), and (3) any
**permission set** on that resource (§3.2). Grants and permission sets only ever *add*
(monotonic). That authority is then bounded by **two coarse caps** (`∩`): the **global
read-only role** (refuses write-verbs) and the credential's **`scope`** (§2.5, the survey's
`authority(identity) ∩ attenuation(credential)`). So the full pipeline is: *authority =
admin-baseline ∪ object grants ∪ permission sets; effective = authority ∩ global-read-only-role
∩ credential-scope*. `ADMINISTER` *contributes* the admin baseline for `read`/`delete` (still
subject to the caps — a *scoped* admin key is narrowed); **only the SYSTEM / admin-secret path
bypasses the caps** (§2.6). (Many cells above —
global-object verbs, whether `manage` is ever delegated below admin — remain open; the *shape*
of the oracle is not. And whether the read-only role genuinely *caps* object grants is itself
the open §2.13 fork.)

### Mental model: the whole thing in one formula

> **`effective(user, action, object) = ( admin-baseline ∪ reaching-grants ∪ permission-sets ) ∩ global-read-only-role ∩ credential-scope`**
>
> Authority is **additive** (`∪`): an admin baseline, the grants that reach the user
> (directly, via a group, or via `everyone`), and any permission sets. It is then bounded
> by **two coarse caps** (`∩`): the **global read-only role** (refuses write-verbs) and the
> **credential's `scope`**. There are **no deny rows** — every per-object "no" is the
> **absence** of a reaching grant — and **no per-object cap**. One exception: the
> **SYSTEM / admin-secret** credential is *not* narrowed by the caps (§2.6).

That is the whole model. **Read visibility** — what this doc's strawman is about — is the
additive `∪` core: monotonic, allow-only, fail-closed. The two `∩` caps are **coarse**
(verb-level and subject/credential-scoped — never per-object, never deny edges). The
[survey §3](./access-control-survey.md) lays out the *general* `∪ / ∩ / ∖` design space;
Phoenix uses this small subset of it — notably **no `∖` deny and no per-object `∩`**.

*(One term is not yet settled: the `∩ global-read-only-role` cap reflects **current / Lean-A
behavior**. Whether the global read-only role genuinely **caps** object grants — or is merely a
liftable **default** (all-floors) — is the open §2.13 fork. Read the formula as "under Lean A.")*

**Definitions — used exactly, throughout.** (The metaphors that recur — "color", "cap",
"fiat", "floor" — are bound here; after this they are precise terms, not imagery.)

- **Grant edge** — a stored row asserting `(subject, access level, object)`: "this subject
  holds *at least* this access level on this object." It is always an *allow*; it is the only
  stored access primitive.
- **Access level** ("color") — the permission content carried on a grant edge: the verbs of
  the §1 verb model (`read`, `annotate`, `manage`, `grant`, `delete`). It is a **partial
  order, not a scalar**, so access levels compose by **union of permissions**, never a numeric
  maximum.
- **Subject** ("who") — a grant edge's left endpoint: a **user**, a **group** (resolved to its
  current members), or **everyone**. Groups are many-per-user and purely additive.
- **Object** ("what") — a grant edge's right endpoint: a project, dataset, or prompt; its
  containment children inherit (§2.7).
- **Effective access** of a user on an object — the **union** of the access levels of *every
  grant edge that reaches them* (held directly, via any group, or via *everyone*), **then
  clipped by the caps** (the formula's `∩` terms). Adding a *grant* never lowers it (the union
  is monotonic); the *caps* are what bound it. So "effective access" is the **union-under-the-
  caps**, not the bare union — the bare union is the user's *authority*, before caps.
- **Global role** — the single, mandatory, per-user tier (`SYSTEM`/`ADMIN`/`MEMBER`/`VIEWER`;
  one `users.user_role_id` FK column). It is **not** a grant edge. `ADMIN`/`SYSTEM` contribute
  the **admin baseline** (below); `VIEWER` / read-only is one of the two **caps** (below) — a
  coarse refusal of write-verbs. `MEMBER` confers **no per-object access beyond its own
  grants**.
- **Admin baseline** — `ADMIN`/`SYSTEM` as a global role contribute maximal authority *before*
  any grant is consulted, so admin works even if the grant tables are empty. It is **still
  bounded by the credential's `scope`** like everyone else's authority — a *scoped* admin key
  does less than its owner. This is the §1 precedence paragraph's `ADMINISTER` baseline;
  "baseline," not "override," precisely because scope still narrows it.
- **SYSTEM / admin-secret backstop** — the one path the caps do *not* narrow: presenting the
  static admin secret authenticates as SYSTEM, which credential `scope` cannot attenuate and
  fail-closed does not apply to (§2.6, §3.6). This is the true unconditional override and the
  highest-value credential in the system.
- **Absence (fail-closed)** — the *only* representation of "no" for reads: no reaching grant
  edge ⇒ denied. There are **no stored deny rows**.
- **Cap (`∩`)** — a bound applied *after* authority is computed. Phoenix has exactly **two,
  both coarse**: the **global read-only role** (refuses write-verbs) and the credential's
  **`scope`** (`authority ∩ scope`, §2.5). Both are verb-level and known from the
  subject/credential alone — **neither is a per-object clearance, neither is a deny edge.**
  (`scope` is also called **attenuation**; it earns its place because a key must track its
  owner's *dynamic* authority minus a fixed narrowing — the one thing absence cannot express
  without copying edges.)
- **Permission set** (the `PermissionSet` model) — a reusable named bundle of permissions for
  one object type, conferred by a grant; purely additive (a **floor**), distinct from the
  global role.

**Stated precisely:** *a user may perform an action on an object **iff** the action's access
level is contained in their **authority** — `admin-baseline ∪ reaching grants ∪ permission
sets` — **and** the action survives both coarse caps: the **global read-only role** (write-
verbs refused) and the **credential's `scope`**. There are no deny rows and no per-object cap,
so every other "no" is the **absence** of a reaching grant. The one exception is the
**SYSTEM / admin-secret** credential, which the caps do not narrow (§2.6).*

**Worked example — follow one read.** Alice is a `MEMBER` with no grants. She opens the
project list and it is **empty**; Project P returns *not-found* — not because anything forbids
her, but because no grant edge reaches her (**absence** is the only "no"). An admin then grants
`read` to the **ML-team** group on P; Alice is a member, so a reaching edge now exists and **P
appears** (**effective access = the union of reaching edges**, here arriving through her
group). Delete that grant and P **vanishes again** — still nothing *denies* her; the access
simply isn't there (**no deny rows**). Throughout, **Dr. Bob** (an `ADMIN`) sees P with no
grant at all, and would still see it if every grant row were deleted (the **admin baseline** —
it precedes grants). But Bob is not above the caps: he mints an ingest-only API key, and its
`scope` **narrows** even his authority, so the key cannot read P's settings though Bob's own
session can (`authority ∩ scope`). The *only* thing the caps cannot narrow is the
**SYSTEM / admin-secret** path (§2.6) — not an ordinary admin key. That one paragraph
exercises every term in the definitions.

**Thought experiment — can joining a group ever take access away?** No. Adding Alice to
ML-team can only *add* reaching edges, never remove one. If joining a group *did* lower her
access, that group would be carrying a cap — a "restriction group" — and the model would be
non-monotonic in membership. Phoenix deliberately has no such thing: caps live only on a
single per-subject clearance (the global role, a credential's scope), never on a group.

**Thought experiment — is "viewer" a promise Alice will never write?** It depends *which*
viewer — and conflating the two is the trap. A **global `VIEWER`** (the role) **is** an
unliftable write guarantee: the `IsNotViewer` / `IsNotReadOnly` gates refuse her writes
regardless of any grant, so even an object **Manager** grant via a group gives her *visibility
only*, never write (this is the §2.13 fork — and the reason that "manage may be delegated"
holds only for MEMBER+). What is *liftable* is the **other** "viewer": a **`MEMBER`** who
merely *holds no write grant on P* — a group `Editor`/`Manager` grant on P **does** give her
write, because she clears the global gate. So: **global-role read-only is a hard, unliftable
cap; per-object "viewer-by-absence" (for a non-VIEWER) is liftable.** What the strawman lacks
is a *per-object* clamp — read-only on one project for someone who writes elsewhere.

The remaining design choices — beyond what the formula already states, and the ones that most
often trip people up:

- **Viewer splits in two — don't conflate them.** A **global `VIEWER`** is an *unliftable*
  write cap: the `IsNotViewer` / `IsNotReadOnly` gates refuse writes regardless of grants, so an
  object Editor/Manager grant confers *visibility only* (§2.13). Separately, a **non-VIEWER who
  merely lacks a write grant on P** is read-only on P *by absence* — and that **is** liftable (a
  group `Editor` grant on P gives them write). What the strawman does **not** have is a
  *per-object* clamp making an otherwise-writing user read-only on one specific project.
- **Groups are additive subject sets; a cap must never live on one.** Groups are first-class
  grant subjects (Pattern 1), many-per-user, composing by `∪` — so adding someone to a group
  can only ever *grant*, never revoke. Putting a cap (or deny) on a group would make joining a
  team silently *reduce* access (a non-monotonic "restriction group"); the strawman does not
  do this. (Object-side tag predicates — the `which`-on-the-object mirror of a group — are
  rejected at the coarse grain, §2.11.)
- **Permission sets are *floors*, never caps.** A custom **permission set** is a
  `(color × object-type)` bundle that only ever *adds* (a `∪` floor), so it is safe under the
  monotonic model and ships via a separate permission-set table (§3.2). It is **not** a cap: in a
  no-deny world a **permission set** *cannot* restrict below what other grants give (that would be
  a deny edge). A **custom *global* role** is the different, higher-scrutiny case — it edits the
  global tier itself (the admin baseline / caps)
  and needs the closed-set column migration of §3.2 — strictly higher-scrutiny, and out of
  strawman scope.

*Naming caution:* "role" is overloaded. The **global role** (one mandatory tier per user —
`SYSTEM`/`ADMIN`/`MEMBER`/`VIEWER`, a single FK column) and a **permission set** (the
`PermissionSet` model — a per-resource, many-per-user color bundle conferred by a grant) are
different things (survey §3), and discussion derails when the two are conflated. Where the
distinction matters, say *global role* vs. *permission set*.

### FAQ — the recurring confusions

- **Built-in vs. custom role?** A **mutability/provenance** distinction (`is_built_in`),
  orthogonal to the model: built-in = seeded, immutable, a closed set (semantics can live in a
  **code constant**); custom = admin-authored, editable, free-form (semantics **must** be DB
  data). Always ask the **grain** — a custom *global* role (the tier; deferred, §3.2) vs. a
  custom *permission set* (per-resource; ships).
- **What is a permission set?** The **object-scoped, additive bundle a grant confers** (view /
  edit / manage) — the "color" of a grant edge (the `PermissionSet` model). It is **not** a
  global role and **not** a cap; it only ever *adds* (a floor).
- **Floor vs. cap?** A **floor** adds — "at least this much" (`∪`); a **cap** bounds — "no more
  than this much" (`∩`). Object grants / permission sets are floors; the global `VIEWER`
  read-only role is a cap.
- **Can a `VIEWER` write if granted Manager on a project?** The **§2.13 fork.** Under current /
  Lean-A behavior, **no** — global `VIEWER` is a hard cap, so the Manager grant confers
  visibility only. Under all-floors (Option B), **yes** — the object grant lifts them for that
  project.
- **Why not put caps on groups?** Because then **joining a group could *reduce* access** —
  non-monotonic and surprising ("a team I joined removed my write"). Phoenix keeps groups
  **additive only**; a cap lives on the single per-subject clearance, never on a group (§2.13).
- **Why does Phoenix have `role_permissions` if grants exist?** Because the **global role's
  behavior (the read-only cap, the admin baseline) lives *outside* the additive grant graph** —
  grants are allow-only floors and cannot express a ceiling, so the global-role layer is
  persisted separately. It isn't *strictly* required, though: the built-in roles are enforceable
  from the `BUILTIN_ROLE_PERMISSIONS` **constant**, so the table is **forward-compat for custom
  global roles + uniform resolution**, not a hard dependency (§3.2).

---

## 2. Design tensions

This section is the **analysis that produced the §1 strawman** — most of these questions the
strawman *resolves* (each subsection opens with its resolution), and they are kept as the
reasoning behind a choice, not as live forks. The handful that remain genuinely open are
collected in §1's *Open decisions*. Read §2 to understand *why* the strawman is what it is —
including why the everyone-allow model is documented and rejected — rather than as a menu of
undecided options.

### Birth and creation

*Default visibility, who may create, ownership, and identity churn at the moment a resource appears.*

#### 2.1 Open-by-default vs closed-by-default for machine-created resources

This is the deepest question in the design, and it is easy to answer by accident.

**Strawman resolution (§1): fail-closed, admin-only, monotonic.** New ingest-born projects
default to admin-only; **read visibility** is **monotonic allow-only** — grants only *add*,
with no deployment-wide open baseline. Datasets and prompts (user-created) default to creator-private.
The rest of this section is *why* that choice, told against the alternative it rejects.

**The rejected alternative: everyone-allow + shadowing.** The opposite default — every new
project visible to everyone until a grant narrows it — is operationally gentler (the flag
flip is a no-op). It is rejected for two reasons. First, it is **fail-open**: a new project
is exposed until an admin acts, which a security review rightly challenges. Second, it is
**non-monotonic**: a narrowing grant does not *add* access, it *shadows* the everyone-baseline
(the object becomes private to the named subjects), so the model needs an apparatus —
specificity precedence, a notion of "restricted," and a rule for the **last** grant. That
last point is a real footgun: if "restricted" is *inferred* from grant presence, deleting the
last grant **silently reopens the object to everyone** — "remove access" becomes "publish" —
and closing it requires an explicit `restricted` marker, more machinery still.

**Admin-only-monotonic makes all of that disappear.** Closed-by-default means grants are
purely additive: no baseline to shadow, no specificity precedence, no `restricted` marker,
and removing the last grant leaves an object admin-only — never reopened. That simplicity,
plus fail-closed's benign failure mode (§1), is the case for the strawman; the cost (a
hard-cutover flip, admins-in-the-loop) is in §1 and §3.5.

**Why the strawman also makes deletion admin-only:** the same logic. Project deletion is
*destructive*, and ingest-born projects have **no non-admin owner** to entrust it to (§2.3) —
so there is no natural party below admin to hold delete authority. Admin-only delete is the
conservative default for a destructive action on an ownerless resource; like the rest of the
strawman it is meant to be *relaxed* later (e.g. delegating delete via a grant), not the end
state.

The default is chosen **per type, explicitly** — projects admin-only, datasets/prompts
creator-private — not inherited from whichever seed ships. One case the per-type call must
still cover: the **playground** project (§2.8) is a single *shared* project holding every
user's prompt-playground traces (often sensitive prompts), so its open question is
*shared-vs-per-user*, not open-vs-private — a posture chosen by construction today, not
deliberately. (The structural resolution — a default scoped to a *container's* members rather
than the whole deployment — is what a tenant layer buys; see §5.)

#### 2.2 Ingestion-time authorization: creation and partial batches

**Strawman resolution (§1): ingestion stays unimpeded.** Any **ingest-capable** credential may
create and write any project — *project-level grants* don't gate ingest, but the credential's
own *scope* still does (a read-only key cannot ingest; §2.5). This is safe under
admin-only-default because **creation
exposes no read access** — a new project is visible only to admins until granted, so there is
nothing to gate at creation. It also closes the bypass an open-by-default model would have
had: there, a key *blocked* from project P could emit under a new name, auto-creating an
*open* P2 and landing its data somewhere visible; admin-only makes that pointless. So the
whole "who may create / who may write" fork — load-bearing under the rejected open baseline —
dissolves.

**The cost of ungated writes: unbounded invisible projects and possible poisoning.** The
creation half is not a *confidentiality* problem (ordinary users can't see admin-only
projects), but it is an **operational** one: any key can spawn arbitrarily many admin-only
projects — clutter in the admin's all-projects view, triage load (admins must sort real from
junk before granting), and a soft resource-DoS. There is also an **integrity** half: if writes
are truly ungated by project grants, any ingest-capable credential that can name an existing
private project can append telemetry to it. That can pollute another team's traces,
dashboards, metrics, and any future evaluator fed by those traces, even though it does not let
the writer read the result. Treat that as an accepted trade only if the mitigating boundary is
explicit (credential scope, per-key project allowlists, signed routing context, quotas,
auditing, or eventually gated writes). The takeaway: ungated writes are *read-safe* but not
automatically acceptable *product* behavior; "unbounded invisible project creation" and
"write poisoning of existing projects" are the costs to weigh.

*If write-gating ever returns,* it reopens **partial-batch semantics** (an OTLP batch mixing
allowed and disallowed projects must choose accept-partial, reject-whole, or per-item-errors)
— moot while writes are open, and the only durable rule is that whatever drops must be
**counted and surfaced**, never silently discarded (§3.7).

#### 2.3 Is "ownership" even the right model when there is no creator?

The survey's graph has a `user ──ownerOf──▶ resource` edge: the creator gets a grant. For
a machine-created project there is no creator to attach it to, so the instinct is to
*patch* the model — invent a standing owner, or assign a system identity.

The deeper move is to question whether ownership is the right primitive here at all.
Ownership is fundamentally a *UI-creation* concept ("I made this, I control who else sees
it"). A project that materializes from a pipeline has no one in that relationship to it.
An alternative model: machine-created resources are **governed by group and admin grants
only** — no owner, access is purely "which teams were granted this project," and the admin
role is the backstop. User-created resources (datasets, prompts) keep ownership because
there genuinely is an owner.

This matters because "give every project an owner" sounds harmless but quietly commits the
system to manufacturing a fake owner for the 99% case, and to a UX that implies a person
controls something no person created. Worth deciding deliberately. (The structural answer —
the resource inherits a *container's* access instead of needing an owner at all — is the
tenant layer of §5; "governed, not owned" is exactly what a space-with-members provides.)

Note the no-creator problem is specific to **ingest-born** projects. For experiment and
dataset-evaluator projects (§2.8) the robust rule is **access-by-parent**: their access
derives from the parent dataset/experiment, full stop — that holds with auth on or off and
never depends on a stored owner. The parent *also* records a creator (`user_id` on the
experiment/evaluator) *when auth is enabled*, but that is the weaker, conditional signal —
nullable, `ON DELETE SET NULL`, and absent on auth-off deployments — so lean on
parent-access, not creator-ownership. Among the system-generated kinds, the shared
**playground** project is auto-*provisioned* but human-*triggered* — which is why its
posture is open rather than settled-ownerless (its lean is creator-owned; see *Open
decisions*).

This exposes a sharper line than *project vs dataset*: the ownerless default keys on **how
a project is born**, not on the `project` table. A project that **auto-vivifies** when the
first span names it has no author to attach; a project brought into being by a **deliberate
create** — a `POST /projects` call, opening a playground — has one, exactly as a dataset
does. The implemented discriminator is the table (it is a project, so it inherits the
project rule), which silently routes an explicit human create into the ingest-born
admin-only bucket and locks the creator out of what they just made. If provenance is the
principle (§1), the discriminator should be **create-intent**: explicit authoring earns a
creator grant, and only auto-vivification-on-ingest is genuinely ownerless. One caveat keeps
the line honest — *create-intent*, not "a user is on the request": an authenticated ingest
write also carries a user (§2.2/§2.5), so keying on user-presence would wrongly mint a
creator-owned project on the first span. Which posture to adopt for the explicit-create case
is deferred to *Open decisions*.

#### 2.4 Should a recreated same-name resource inherit prior grants?

A project deleted and re-created under the same name via later ingestion gets a **new id**
— this is `main`'s behavior today. The safety answer is clear: grants should key on the
durable id, so old grants are dangling and the new project starts clean — silently
re-attaching access to logically-new data would be a leak.

But the *product* intent genuinely conflicts with that. A user who deletes and re-creates
"my-project" through their pipeline reasonably expects "give me my access back," not "a
stranger's blank project." The tension is real: id-keying is correct for safety,
name-continuity is what the user expects. There is no free answer — only a choice about
which surprise is more acceptable, possibly mediated by an explicit "restore grants"
affordance rather than automatic inheritance. The safe branch (id-keyed, no inheritance)
is defensible, but it should be a known, stated trade rather than an accident of schema.
(A tenant layer softens this too: a re-ingested resource re-lands in the same container and
inherits its **container default** access, so continuity comes from the container even though
the id still changes; see §5.)

### Identity and authority

*Who acts, and the credentials and identities they wield.*

#### 2.5 Service accounts: credential or identity?

On `main`, a Phoenix API key wields a *user's* identity — every key belongs to a user and
is deleted with that user, and the "system" key is just a key against a SYSTEM-role user,
not a first-class non-human identity. There is no service-account identity, so the
offboarding problem is latent: a pipeline authenticated by a departed employee's key
breaks when that user is deprovisioned.

Two honest paths (the survey's credential-vs-identity fork):

- **Option A — stay credential-only.** Keep keys tied to users; add an attenuating *scope*
  so an admin can mint narrow, purpose-built keys (ingest-only, single-project write). No
  new subject kind, the oracle is unchanged, and it is sufficient for most ingestion. Left
  unsolved: the key still dies with its owning user. *(The prototype takes this path — the
  `scope` is the attenuation half of the effective-access formula.)*

- **Option B — first-class service accounts.** Add `service_account` as a subject kind so
  a non-human identity holds grants directly and can be a group member. It composes with a
  generic grant table — the grant's subject reference does not care whether it points at a
  user or a service account, and the oracle's signature is unchanged (only the resolution
  of `authority(...)` differs). The cost is a service-account table, a credential lifecycle
  independent of any user, and management UI.

**Recommendation: Option A now, reserve for B.** If the grant model is polymorphic over a
subject-kind discriminator, reserving room for `service_account` in the schema shape is
cheap and avoids a later migration — the same "reserve the field, defer the semantics"
discipline the survey applies to the `effect` column. But "reserve" is not "accept": until
the lifecycle and authority resolution are designed, the system must **reject**
`service_account` rows, not silently store them. A half-built subject kind that the
database tolerates is one that fixtures, GraphQL enums, UI pickers, and call sites will
start depending on before it works — the same trap as a `deny` `effect` that nothing
enforces. Build the identity and lifecycle only when a concrete "this pipeline must survive
offboarding" requirement lands.

#### 2.6 The SYSTEM user is a break-glass backstop, not a workhorse

On `main`, Phoenix seeds a single hidden **SYSTEM** user: a superuser carrying every
permission (`READ`/`WRITE`/`ADMINISTER`), with no usable password, filtered out of every
user- and role-listing query, and refused by the user-management mutations. It is the
identity behind the `PHOENIX_ADMIN_SECRET` (presenting that secret authenticates as the
SYSTEM user) and the owner of "system" API keys. It exists so the server always has an
authority of last resort. The recurring design mistake is to reach for it whenever an
identity is missing — and there are two such temptations, both of which should be
resisted.

- **Do not make SYSTEM the owner of ownerless resources.** §2.3 notes machine-created
  projects have no creator. SYSTEM is the tempting backfill, but "owned by SYSTEM" means
  *owned by an invisible god-user* — it conveys no per-team access and conflates "nobody
  owns this" with "the superuser owns this." If §2.3 resolves to group/admin governance,
  SYSTEM must explicitly **not** be written in as owner.

- **Do not make SYSTEM the identity for routine machine traffic.** A collector
  authenticated as SYSTEM is an unattenuated superuser performing `write`. Ingestion
  should use *attenuated* credentials (ingest-only scope), and the clean end state is
  first-class service accounts (§2.5) — a distinct, non-SYSTEM, scoped subject kind.
  Modeling automation as additional SYSTEM users would multiply superusers, the opposite
  of least privilege.

Two further consequences worth stating plainly:

- **SYSTEM must be filtered out of the audit answer.** Because ADMINISTER reaches
  everything, SYSTEM appears in "who can see this resource?" for *every* object. The
  oracle's `subjects_for` (and every "Sharing" view built on it) must exclude SYSTEM, or
  the answer to "who has access?" is always "everyone, plus a user you can't see."

- **Privacy claims must include administrators — and every SYSTEM-mediated read path.**
  With the flag on, SYSTEM's ADMINISTER override sees everything regardless of grants, so
  "private to team X" is never private *from* SYSTEM or the admin-secret holder. But the
  admin-secret holder is not the only such reader: **background jobs, exports, support and
  debug tooling, and scheduled tasks** that read via SYSTEM (or the admin secret) all
  bypass access control the same way. Each is an *invisible universal reader*. A concrete
  instance is the **server-side experiment-runner daemon** (§2.8) — *not* client-initiated
  experiments, which run under the user's own credential: it reads datasets and prompts and
  writes the experiment project as a background process, so it should act under a scoped
  identity tied to the experiment's creator, not SYSTEM. If any such path touches user data,
  it must either run as a scoped identity instead of SYSTEM, or
  emit an audit record — otherwise "private" is a claim the system cannot honestly make.
  User-facing language should say "private to team X (and administrators)," not "private."
  This applies uniformly to *every* SYSTEM-mediated background reader that can touch the data
  — exports, the retention/cron jobs (§6), and any future background runner — not only the
  experiment runner: each is an invisible reader the "private" claim must account for, so the
  honest copy is "private to team X (and administrators and system processes)" wherever an
  unscoped background job can reach the resource.

The admin secret deserves separate emphasis: it is a **static shared credential that
bypasses the API-key table and the token store**, so the proposed `scope` attenuation
cannot narrow it — it is the one credential the effective-access formula's right-hand side
does not apply to. It appears in no key-listing UI, rotates only by redeploy, and
attributes every action to "SYSTEM" rather than to the human holding it. It is the
highest-value credential in the system and lives entirely outside the RBAC model; treat it
as the thing to guard, log, and rotate first.

### Resource graph

*How access flows through containment — and what breaks when the graph is mutated.*

#### 2.7 Containment children: sessions, traces, spans

Project sessions — and traces and spans — are the awkward case, but the awkwardness is in
*data modeling*, not access control. A project session is created lazily on first ingest,
keyed on a client-supplied string (`session.id`, usually `"default"`), with a time window
that extends as later traces arrive, and an identity meaningful only as
`(project_id, session_id)`. None of that needs to touch access control, because the right
model is unambiguous: **these are pure containment children — never grant subjects, with
access inherited entirely from the containing project.** Every child has a path up to a
project (`ProjectSession.project_id`; `Trace.project_rowid`; `Span → Trace → project`), and
the prototype already reflects this — only `project`/`dataset`/`prompt` are grantable
object types; sessions, traces, and spans are not. Cardinality settles it even if one
wished otherwise: there are orders of magnitude more spans than projects, so per-object
ACLs on them are a non-starter. This is §2.3's "governed, not owned" in its clearest form —
no one would claim to *own* a span.

Three consequences follow:

- **The containment edges are security-load-bearing.** Once a child's access is inherited
  through `project_id`, the integrity of that edge *is* an access boundary. A bug that lets
  a span attach to the wrong project's session — exactly the `session_id="default"`
  collision in §3.3 — stops being a data-quality glitch and becomes a **cross-project
  leak**: a viewer scoped to project A sees a trace that drifted in from project B. So the
  session-scoping fix is a precondition for sound inheritance, not an incidental cleanup
  (§3.3 is annotated accordingly).

- **The risk is surface-area, not mechanism.** Because access lives on the project and
  nothing is stored on the children, the danger is the *many* read paths — span search,
  session lists, trace detail, dashboards, metrics, exports — each of which must
  independently filter by "containing project ∈ my accessible projects." One child-read
  endpoint that forgets the filter is a silent leak that no project-level test will catch.
  This is where the single-oracle discipline earns its keep: every child query should
  express access as the same reusable predicate (a semi-join,
  `child.project_id IN (accessible_project_ids)`), never a per-row check or a hand-written
  `WHERE`.

- **What it makes *easy*, don't over-build.** Inheritance means a project flipping to
  private renders all its children inaccessible immediately — no fan-out write to millions
  of rows — provided nothing caches child access independently of the project's. And
  because children are never granted, their constant ingest-churn produces zero orphaned
  ACL rows (the §2.12 cleanup concern bites only grantable types). The highest-volume
  objects are the ones access control touches least.

The one genuine exception is **user-authored children**: span/trace/session *annotations*
have a real creator, unlike a span. They are the sole candidate for a finer rule —
read-access still inherits from the project, but *edit* might be scoped to the author
("you can only edit annotations you authored"), which is precisely the survey's sub-object
/ Family-B example. Keep the machine-created children pure-inherit; treat an authorship
layer as something added only on top of project inheritance, only for authored sub-objects,
and not generalized to the hierarchy.

#### 2.8 Rooting access at the data context: the telemetry and dataset worlds

Step back from "kinds of project" to the structure underneath. The rule is one principle,
not a taxonomy: **a resource's access is rooted at its real data context.** For
trace-bearing, project-contained data, applying it yields two common access roots
(deployment-global objects outside any project have no data context to root at — §6):

- **Telemetry world** — application **projects**: machine-created by ingestion, no human
  creator → **admin-only** (§2.1).
- **Dataset world** — **datasets** (and prompts): human-created, a real creator →
  **creator-private**.

Nearly everything else hangs off one of these — and where something doesn't (playground,
below), the principle, not the pair, decides. The clarifying question is *what produces a trace?*
A **dataset produces none** — it is data (the access *root*), not an execution. **Experiment
and evaluator runs** produce traces (the task and judge executions). Those traces sit in
`projects` rows only because "project" is Phoenix's span container — **storage reuse, not a
third kind of access subject.**

That is the principle at work: **eval traces (and the scores on them) are
run-artifacts rooted at the data context they evaluate.** A dataset's access governs its
*entire* world — the dataset, every experiment and evaluator run on it, and all their traces.
*One* access decision (the dataset) governs the whole eval workflow.

##### Hidden eval-trace projects

The `Experiment-<hex>` / `dataset-evaluator-<hex>` projects are exactly this plumbing:
random-named and *hidden* (today via name-pattern + the `exclude_*` joins; cleanly via a
**server-set `kind` discriminator** that marks "plumbing vs real project," §4). They are not
standalone projects.

For the hidden kinds, access must derive from the **parent dataset/experiment**, not from an
independent grant on the project — the same containment rule as above, run *upward*
(dataset → experiment → experiment-project → spans). Treating them as ordinary top-level
projects gets it wrong either way: under the strawman's **admin-only** project default, the
experiment's *own (non-admin) creator* can't see their own results; under the rejected
everyone-allow model, the inverse bug — anyone who can name the project reads the
experiment/eval traces. Both are why these need access-by-parent, not the plain project
default. This also **doubles the coverage obligation**: every project-surfacing read must
apply *both* the access predicate *and* the hide-internal predicate (the list and count do;
a path that forgets either leaks a hidden project or an inaccessible one).

**Experiments and experiment jobs.** Experiments (`Experiment.dataset_id`) and their runs
are likewise children of a dataset, so experiment access derives from the dataset. An
**experiment job** (`experiment_jobs`, 1:1 with its experiment) is the *execution/lifecycle*
layer (status, concurrency) — it holds no traces and grants nothing, so it is **not** an
access resource; but the *actions* on it (start/stop/resume) are authorization-relevant and
should inherit the dataset/experiment's access. One trap to avoid: an experiment job's
`claimed_by`/`claimed_at` is a **worker claim** (which background worker is executing, for
concurrency) — *not* access-control ownership of the kind §2.3 discusses.

This corroborates the **containment principle** at a mature peer (the tag/attribute vendor of
the survey, §4): in its model **datasets and prompts are standalone grantable resources**
(each with its own permission set), while
**experiments are *not* a distinct access-controlled resource** — an experiment is "the
results of evaluating on a dataset," so its access flows through the dataset, and its runs
inherit the parent project. That validates the *principle* proposed here — grant on
datasets/prompts/projects; derive experiments from the dataset, runs from the project. It is
**not** evidence for the specific hidden-`Experiment-<hex>`-project mechanism: where the
peer physically stores experiment traces is unresolved (its docs are ambiguous), so the
containment *principle* is corroborated, the *trace-storage analogue* is not.

##### Execution models: who reads and writes

The two execution models have **different actor models**, and only one involves a background
reader:

- **Client-initiated (SDK).** The client calls `POST /datasets/{id}/experiments` with the
  *user's* credential; the server generates the project name and returns it, and the client
  then runs the task locally and **uploads its traces via its own ingestion** (tagged with
  that returned name), plus structured runs/evaluations. The user is the actor throughout —
  **no background reader**, so the §2.6 invisible-reader concern does not apply here. What
  does apply is §2.2: the client writes spans into a *server-assigned, hidden, parent-owned*
  project, so the ingestion path must authorize that write — but it is the *controlled* case
  (authenticated key, server-chosen name), not the anonymous-auto-create one.
- **Server-side (runner daemon).** The `ExperimentJob` runner executes the task on the
  server, reading the dataset/prompt and writing the experiment project as a background
  process — *this* is the §2.6 invisible-reader, and the one that needs a scoped identity.

The server-chosen hidden project name is not itself a durable security boundary. Under
ungated ingest, `Experiment-<hex>` behaves like a narrow **capability string**: possession of
the name is enough to write spans to that plumbing project. The property doing the security
work is unguessability by an adversary, not collision avoidance, so the name should carry the
survey's capability-URL discipline — minting is
privileged, the value is secret-bearing, use is auditable, and revocation is possible — or,
better, replaced by a scoped write authorization for `kind=EXPERIMENT` / `kind=EVALUATOR`
projects that is tied to the parent run and cannot be reused as a general project-name write.

##### Online evals

**The principle generalizes — and online evals prove it isn't really "the dataset."**
*(Online evals are a separate concurrent design effort, not current `main`; the shape below is
drawn from that workstream's design, and the trace-placement is a proposal, not an
observed behavior.)* An *online* evaluator judges **live production traces**: there is no
dataset; the data context is a **production project**. So the root is not specifically the
dataset — it is *the data context being evaluated*: a dataset offline, a production project
online. The score is an annotation on the production trace (it inherits the production
project's access); the judge's own trace is cleanest **attached to the trace it judged**
(inheriting that access) rather than parked in a new project. The online runner is the §2.6 background-reader *at scale* —
continuous, cross-project production reads — so it must run as a **scoped identity**, not
SYSTEM. (This is also why a denormalized `project.dataset_id` is the wrong cache: online has a
*project*, not a dataset, as its root. Root the artifact at the *run*, §4.)

##### Playground

**Playground fits neither common root — its data context is the user who ran it.** Its
prompts are the most sensitive
data in the system, so the shared singleton it is today is a latent leak. The lean is
**per-user `kind=PLAYGROUND` projects, auto-granted to the creator** — which keeps access
uniformly *project-level* (no sub-resource exception). The alternatives: shared-everyone
(leaks), admin-only (hides the user's own runs), or one shared project + per-run attribution
(pays its cost as a mostly-NULL `created_by_user_id` on the hottest table, `traces`, plus a
bespoke read filter). Still an open decision (§1), but "shared" is rejected as the default.
Worth flagging that this is a **third root chosen by the principle**, not a variant of either
common case: playground traces are *machine-ingested* (telemetry-world mechanics) yet
*creator-private* (dataset-world semantics), and the data-context rule is what resolves the
clash — the context is the creator. Implementers should treat it as a deliberate hybrid — per-user
`kind=PLAYGROUND` with a creator grant — rather than silently bucketing it with ordinary
telemetry projects (which would make it admin-only and hide a user's own runs).

##### User-named experiment projects (#13726)

**#13726 fits the frame, not as a special case.** A real request asks to let an experiment
write to a *user-named* project (to consolidate eval runs into one browsable place). That is
the user **promoting eval traces out of plumbing into a real telemetry-world project** —
visible, persistent, separately grantable, decoupled from the dataset. It falls out of the
`kind` dispatch (omit a name → plumbing `kind=EXPERIMENT`; provide one → a normal
`kind=TELEMETRY` project), which is the clean way to ship it rather than the name-pattern
classification the issue proposes.

A *related* category sits one step further out — objects that belong to **no project at
all** (secrets, the shared evaluator/annotation-config/model/label library, admin config).
The containment rules here don't reach them; they get their own treatment in **§6**.

#### 2.9 Moving or copying data across boundaries

There are two cross-boundary shapes, and they need different policy words. A **move** changes
the containment edge of existing data, so access follows the destination. A **copy** creates a
new object containing data derived from a source, so source and destination can diverge.
Phoenix has both shapes: trace transfer is the move case; "create a dataset from spans/traces"
is the copy case.

The copy case is easy to miss because it does not mutate the source graph. A user with read
access to project P can select spans/traces and materialize them into a creator-private dataset
whose grants are independent of P. That may be the intended product contract — read access
implies the right to copy/export and then share under the dataset's policy — but it is a real
exfiltration decision, not an implementation detail. If that contract is too broad, dataset
creation from telemetry must check more than source `read`: it may require `manage` on P (or
a new, finer verb — an explicit `export` right — added to the §1 verb model), inherit the
source project's access until deliberately relaxed, record source lineage,
or restrict downstream grants. Pick one; do not let "copy, not move" bypass the two-container
thinking below.

Trace transfer is the concrete instance of a general rule worth stating explicitly, because it
will recur (dataset moves, prompt copies, any future reparent): **any operation that mutates
a containment edge must check authority on *both* the old and the new container, move the
entire access-derived subtree atomically, and emit an audit event.** A move is the one
operation that changes *inherited* access, so it is governed by the source and the
destination at once — and it is exactly where the convenient "access just follows
containment" model needs the most care.

Phoenix's instance of this is transferring traces between projects (a
`transfer_traces_to_project` mutation that re-parents traces by updating
`Trace.project_rowid` — though verify the current implementation per the status note). It
is the one supported operation that *deliberately mutates* the security-load-bearing
containment edge of §2.7, which makes it the single most sensitive write in the child
hierarchy. Today it is gated only by global role checks (not-read-only, not-viewer); under
access control that is not enough.

- **A move is a two-sided operation; one check is wrong.** Reads and ordinary writes touch
  one resource; a move touches a *source* and a *destination* and needs authority on both.
  A global-role gate would let a user who can see neither project re-home traces between
  them. The correct check is per-project on both ends — *manage/ADMINISTER on the source*
  (data is leaving it) **and** *write on the destination* (data is entering it) — and the
  destination must be a project the caller can actually access, not any id in the system.

- **It is an exfiltration and a concealment vector.** With private projects, transfer can
  move traces *out* of a private source into an open destination (exposing them to people
  who could never see the source), or move someone's traces *into* a private destination
  (hiding them from those meant to see them). The one-sided default-visibility lesson of
  §2.1 applies: an open or auto-created destination turns a transfer into an exposure.
  Note the interaction with the verb model (§1): `delete` is admin-only, but `transfer`
  rides on `manage`. If `manage` is ever delegated below admin, a non-admin could exfiltrate
  via transfer-out while being unable to delete — so either keep transfer-out admin-only too,
  or accept that delegating `manage` delegates this exfiltration path consciously.

- **The move must carry the whole subtree — today it does not.** Spans follow correctly
  (they inherit via `trace_rowid`), but a trace's **session** (`project_session_rowid`)
  belongs to the *source* project and is left behind. After a transfer the trace points at
  the destination while its session still lives in the source — the exact cross-project
  break §3.3 warns about, now manufactured by a supported operation, and a read-leak back
  into the source (the source's session still lists a trace that has left). A correct move
  must atomically re-home or detach everything whose access derives from the project — i.e.
  the containment children of §2.7 — not just the `project_rowid` column.

- **Audit it.** Re-homing data across an access boundary is exactly the survey's audit
  shape: after the move, the only record that a trace ever lived in the source is gone. Who
  moved which traces, from where, to where, must be recorded.

### Rollout and operations

*Turning the system on for an existing deployment.*

#### 2.10 Upgrade and rollout for existing deployments

This is where §1's thesis comes due. Every project, dataset, span, and key in an existing
deployment was created *before* any access model existed — so the upgrade is the moment a
system full of ownerless, world-visible resources has to acquire boundaries without
breaking the people and pipelines depending on the old open world. The mechanics are
easy; the *experience* is where the pain is, and it is worth understanding the failure
modes concretely rather than trusting the happy path.

**Two rails bound the whole thing — internalize these first.** (1) Default-off is a true
no-op: the oracle short-circuits to "everything" before any grant lookup, so upgrading and
doing nothing changes nothing, at no query cost, even with the new tables present. The
schema change is additive (new tables, a nullable key `scope`) — no rewrite of existing
rows, so DB size is irrelevant. (2) Reversibility cuts **both** ways, and this is subtle
under fail-closed. *During rollout* — before anything is restricted — flipping the flag back
off restores the open world instantly, which permits a cautious enable; built grants/groups
sit inert while off. *After* a deployment has restricted data, that same reversibility is a
**liability**: turning the flag off (or losing the env var to config drift / a redeploy)
**silently re-opens every admin-only project to everyone** — the roles and grants persist
inert, but the *enforcement* evaporates. So "reversible kill-switch" is a rollout safety
feature *and* a steady-state exposure risk; the disable path must be hardened (see §3.5).

The nullable key `scope` is part of the cutover contract, not just schema convenience. For
pre-existing API keys, `NULL` must have an explicit meaning. The least-surprising migration is
`NULL = unattenuated legacy key` (the key retains whatever authority its owning identity had
before scopes existed), with newly minted keys carrying an explicit scope. That is a
compatibility default, not a security property: operators should be able to inventory,
rotate, and eventually require explicit scopes for old keys. If instead `NULL` means
"ingest-only" or "no authority," the upgrade breaks existing collectors and must be surfaced
as a deliberate breaking change.

**"Existing users" is not one population, and the split is the first pain point.** Access
control grants on *identities*, and an anonymous instance has none:

- **Auth-disabled / open instances** (likely the majority of self-hosted deployments — no
  login, anyone who reaches the URL sees everything) cannot meaningfully adopt access
  control at all until they first enable authentication. For them the upgrade is a no-op
  *and the feature is unavailable*: adopting it is gated on a strictly larger migration
  (create users, distribute credentials, possibly wire SSO). The trap is assuming "turn on
  the access-control flag" is the project, when the real cost is the auth migration
  underneath it.
- **Auth-enabled instances** can adopt it gradually — but inherit every pain point below.

**No *schema* backfill — but flag-on is a deliberate cutover, not a graceful no-op.** The
new tables (object grants, groups) start empty, so there is no per-object data migration —
that part is free. But under the strawman (§1), flag-on does **not** preserve pre-upgrade
behavior: ingest-born projects become admin-only, so **every non-admin loses visibility to
ungranted projects at flip time.** That is the intended fail-closed cutover (§3.5), not a
regression — but it means the safe upgrade move is *flip off → pre-write the grants teams
need → dry-run → flip on*, **not** *flip on and opt into restriction later*. (The
everyone-allow model's "graceful, opt-into-restriction one grant at a time" flip is the
rejected alternative, §2.1.)

Now the pain points, each worth understanding as a concrete failure, not a checklist item:

- **Ingestion does *not* break — a pain the strawman dissolves.** Because the strawman
  gates only *reads*, never writes (ingestion stays unimpeded, §1/§2.2), existing collectors
  keep ingesting straight through the flip. The everyone-allow design had a
  highest-probability incident here — "the moment a project goes private and the ingesting
  key isn't granted *write*, spans silently drop" — and the strawman removes it by not
  gating writes at all. (It would return only if a future design chose to gate ingestion
  writes; until then, this whole failure mode is off the table — a real simplification.)

- **Restriction reads as deletion — and under the strawman it hits *everyone at once*.**
  Because unauthorized ≡ not-found and there is no deny-explainability yet (§2.1; survey
  §17), an affected user does not see "you lost access to project X" — the project
  *vanishes* (a 404, an empty list), and "restricted" and "deleted" are indistinguishable.
  Under the everyone-allow model this bit *per narrowing grant*; under the strawman the
  **flip itself** is the mass-restriction event — every non-admin's ungranted projects
  disappear simultaneously. So the go-live moment is the flip, and the mitigation is
  front-loaded: pre-write grants, announce, name a contact, and *especially* run the §3.9
  dry-run first. This severity is the strongest argument for prioritizing explainability and
  the preview before any non-trivial rollout.

- **The change is invisible before it happens — the missing de-risker.** The flag is
  reversible, but disruption is better *avoided* than *undone*. The oracle already holds
  the pieces (`subjects_for`, `accessible_scope`) to answer "given the current grants, who
  would lose access to what the moment I flip this?" — a dry-run preview. It does not exist
  today, and its absence means the only way to learn the blast radius of enabling the flag
  is to enable it. Building this preview is the single highest-leverage investment in the
  upgrade experience; name it as a gap rather than discovering it during an incident.

- **Empty or half-synced groups lock out the people they were meant to admit.** Existing
  deployments have no groups. SSO-backed groups populate only on each user's *next login*;
  local-only deployments must build groups by hand. A narrowing grant aimed at a group that
  has not finished syncing excludes exactly the members it was supposed to include — the
  restriction lands before the admit-list does. Verify group membership is real before
  relying on a group in a grant; do not flip the flag on the assumption that "the SSO
  groups are there."

The throughline: the binary upgrade is safe (flag-off is a
no-op, reversible), but **the flip is a deliberate hard cutover** — non-admins lose
ungranted projects all at once. The strawman *removes* one of the two classic bites
(ingestion no longer breaks — writes stay open) and *concentrates* the other (restriction-
as-disappearance now happens to everyone at flip time, not drip-by-drip). That makes the
§3.9 dry-run preview and explicit communication matter even more — they are the difference
between a planned cutover and a surprise outage.

### Rejected alternative

*A plausible alternative model that does not fit Phoenix's needs.*

#### 2.11 Attribute-based access (ABAC) isn't justified for project-level access

Could attribute/rule-based access — the survey's Family B (computed edges) — fit Phoenix
better than enumerated grants? **For the current project-level, enumerable problem, no.**
Phoenix's access is **enumerable** ("these teams see these projects"), so Family B's
"everything matching a rule" power solves a problem Phoenix doesn't have here, while adding a
query-time predicate cost and a curation burden. The enumerated model (Family A) is the fit.
(This is a scoped verdict, not "ABAC is never useful" — the exception below is real.)

The one genuine exception is **sub-resource scoping** — a rule *below* the project, like a
`pii=true` or `cost > 5` view — which enumerated project grants structurally cannot express.
That has real value, but it must come from a **server-derived** predicate (a classifier the
server runs, never a client-set attribute), and it is a narrow hybrid (survey §4), not a
general access model.

**ABAC and tenancy aren't either/or — a peer does both, as a hybrid.** Don't read "ABAC
isn't needed" as "the problem doesn't exist." The shared need is **fine-grained isolation
within a shared boundary** — by team, or by data sensitivity (an `env=prod` or PII-only
view). At least one peer in this space layers **two** mechanisms: a **workspace** trust
boundary (a tenant container, the analog of §5) *and*, *below* it, **curated-tag predicates**
for sub-container grouping and access. The predicate runs over *admin-set resource tags*,
**not** client telemetry (its policy engine evaluates only curated tags), which is exactly
why it is the *defensible* form, not a counterexample to the disqualifier above. That is the
survey's §4 **hybrid**: enumerated/role-based at the coarse grain, a narrow curated predicate
at the fine grain. Phoenix's verdict is scoped accordingly: the *project-level, enumerable*
need is handled by container (§5) + grants alone; the curated-predicate layer is precisely
what the **sub-resource exception** above would add if a concrete finer requirement
(`pii=true`, "only annotations I authored") lands. So "ABAC isn't needed *here*" means *not
at the coarse grain* — a peer with a tenant layer still reached for predicates at the fine
grain, as a hybrid on top of its container, not as a replacement for one.

(Scope note: this verdict is for the current target — project-level access, with tenancy in
§5 and sub-resource access not a goal. If that scope widens, the sub-resource exception is
where attributes re-enter the picture, and this should be re-evaluated.)

(One naming caution for that day: if curated access tags are ever added, keep them distinct
from **prompt version labels**. Phoenix prompts are versioned, and a peer that ships both
explicitly separates *commit tags* (which version) from *resource tags* (organization /
access) — conflating "which version" with "who can see it" is a trap worth avoiding by
construction.)

(The concrete shape this fine-grain exception takes — a curated-tag layer expressed as an
*additive grant selector* rather than a separate engine, and the correctness obligations it
inherits from the polymorphic schema and the dual-path oracle — is worked out as an
implementation concern in [Part F of the implementation invariants](./access-control-implementation-invariants.md).
That does not move the verdict above: coarse, project-level access remains enumerated; the tag
layer is the narrow fine-grain hybrid this exception anticipates, and only becomes load-bearing
if a concrete sub-resource requirement lands.)

### Schema trade

*An implementation choice, weighed for completeness rather than product pain.*

#### 2.12 One ACL mechanism vs per-type FK safety

Phoenix has many resource types (project, dataset, prompt, experiment, …). A **generic**
ACL table — addressing objects as `(object_type, object_id)` — covers all of them with one
mechanism and one list query (`grant rows → ids → IN (...)`), and adding a new resource
type is free. But a generic shape **cannot carry a real foreign key**, so it loses
`ON DELETE CASCADE` (grant rows orphan when a resource is deleted and must be cleaned up
explicitly), and it assumes every grantable resource has a uniform primary-key type —
Phoenix's integer ids fit, but a future non-integer-keyed type would not.

The generic table is not merely cheaper, it is **load-bearing for grants that span types**.
A grant can address `object_type='*'` (all types) or a type at large via
`selector_kind='all'` (`object_id` NULL) — the org-wide and admin-baseline grants. These
rows have no home in a `dataset_acls`/`prompt_acls` split: a type-wide row belongs to no one
type's table, and a `*` row belongs to all of them at once. So some grants exist *only*
because the target address is polymorphic — which turns this from "convenience vs FK safety"
into "one branch cannot represent part of the model."

**Per-type** ACL tables are the other branch: they keep cascade and FK integrity but
multiply the schema and turn the oracle's single list query into a union across tables.
The deeper cost is not query count but **parity**: the oracle resolves access along two
paths that must agree — a Python one (`accessible_scope`, materializing ids) and a SQL one
(`access_predicate`, a `WHERE` clause pushed into the query). A single `acls` table lets
both read the same rows the same way; per-type tables would fork *both* paths per type,
hand-maintained in lockstep, and every omission is a silent drift between what the two
paths grant. The generic table forecloses that drift by construction.

Underneath, this is the standard polymorphic-vs-per-type trade. The prototype takes the generic table
(optionality over FK safety); the cost — explicit orphan cleanup and a uniform-PK
assumption — is real and should be revisited if either a non-integer-keyed resource or a
cascade-correctness incident appears.

Because the generic table cannot lean on an FK to fail, the oracle's **read-time** behavior
toward a dangling ACL (one pointing at a deleted object) must be defined, not left to
chance: a grant whose object no longer exists must be **inert — ignored, never
access-granting (fail closed)** — with the rows swept asynchronously. This is not just
hygiene; it is a security requirement that ties back to §2.4. If integer `object_id` is ever a
*reusable* key space (sequence reset, import, a future non-monotonic scheme), a stale ACL on
deleted project 42 must never silently re-grant access to a *new* project 42 — the same
id-reuse leak as §2.4, in ACL form. Keying inertness on existence (the object must currently
exist *and* match) rather than on cleanup-having-run closes the *dangling* window even before
the sweep catches up; the reuse window is closed by cleanup-before-reuse (see the subject-side
treatment below, which mirrors this exactly).

Read-time inertness is the security floor, but **grant *creation* should also validate** that
the target object exists and is of the declared `object_type`. Creation-time validation is
not load-bearing for safety (the read-time check already fails closed), but it prevents
orphan rows, mistyped grants, and the audit noise of grants that never resolved — catching the
error where a human can still correct it rather than letting it sit inert and confusing.

**The same hole exists on the *subject* side — and it is the easier one to miss.** A grant's
`subject_id` is as FK-less as its `object_id`, and for the same reason: the column is
*polymorphic* (a user, role, group, or "everyone" all share it), so no single foreign key can
guard it. Deleting a user is a **hard delete** of the row, and nothing cascades that user's
`subject_kind='user'` grants — so they persist as **dangling rows**. Two distinct
consequences, worth separating because they have different severities:

- **Guaranteed (every delete): cruft and audit noise.** The dangling grants never get cleaned
  up, so the "who can access X?" view (`subjects_for`) can list a *ghost* subject that no
  longer exists, and the `acls` table accumulates rows that resolve to nobody.
- **Latent (only under id reuse): a re-target leak.** *If* the integer id can ever be
  reassigned — sequence reset, manual/import id assignment, or any future non-monotonic id
  scheme — a recycled `subject_id` points the old grant at a **new, unrelated principal**.
  This is the §2.4 reuse class, now mis-aiming the *subject* rather than the *object*, and it
  generalizes to recreated **group** and **role** ids. Under plain autoincrement, ids are
  monotonic and not reused, so this stays latent — but it is exactly the kind of assumption
  that should be guarded by construction rather than relied on. The danger is never the
  deleted user keeping access (they can no longer authenticate); it is the recycled id.

The two halves of the fix attack the two consequences:

- **Cleanup on delete (the load-bearing half):** the delete path for a user/group/role must
  remove that subject's `acls` rows in the same transaction. This clears the cruft *and*
  closes the reuse window before any id can be reassigned — the write-time symmetry of the
  creation-time validation above.
- **Read-time existence guard (the floor):** resolve a user/group/role-subject grant only
  against a subject that *currently exists*, so a dangling grant lists and grants nothing even
  before cleanup runs. Note this guard closes the *dangling* window but **not** the reuse case
  on its own — a reused id refers to a subject that genuinely exists again, so only
  cleanup-before-reuse (or keying grants on a non-recycled subject identifier) forecloses it.

Worth noting what the schema *does* get right by leaning on real FKs elsewhere, which throws
the gap into relief: a resource's **creator** `user_id` is a genuine FK with `ON DELETE SET
NULL`, so deleting a creator leaves a creator-*less* resource that fails closed — it collapses
to *admins + explicit grants*, never widening (a sole-owner dataset with no other grant simply
becomes admin-only-orphaned). **Group memberships** `CASCADE`, so a deleted user cleanly stops
matching group-subject grants. Only the polymorphic `subject_id` — the one column that cannot
carry an FK — is left to the cleanup-plus-read-time-inertness discipline above. The lesson is
the same as the object side: *where a foreign key cannot enforce it, the oracle must.*

### Authority composition

*How the global-role layer and the object-grant layer compose — a tension currently resolved by accident.*

#### 2.13 Does a global read-only role cap object write-roles, or do object grants lift it?

**Lean (to ratify, not yet settled): A — the global role is a hard verb ceiling.** A global
`VIEWER` can never write, even holding an object **Manager** grant via a group; the object
grant confers *visibility only*. This is the conservative, auditable choice — but right now it
is **emergent, not chosen**, and that is the reason to surface it.

**Why it's emergent.** Two layers compose here, and neither was designed against the other.
The new object oracle (grants + permission sets + the `ADMINISTER` override) decides *object*
access. The **pre-existing** global gate (`IsNotReadOnly` / `IsNotViewer`, on the write
mutations) decides *whether a write-verb runs at all*. A write action like `grant_access`
carries **both** — `permission_classes=[IsNotReadOnly, IsNotViewer, …]` **and** an
`OBJ_MANAGE_ACCESS` object check — and both must pass. So a global `VIEWER` in a group granted
`OBJ_MANAGE_ACCESS` on P clears the object check but **fails the global gate**: blocked. The
hard ceiling is what falls out of the gate sitting in front of the oracle — not a decision
anyone recorded.

**The deeper reason: only caps conflict.** Everything the new RBAC adds is a **floor** — object
grants, group grants, direct grants, custom permission sets all *grant* capability and compose by
**union**, which is order-independent and never disagrees with itself (stack `Viewer` + `Editor`
+ `Manager` on one object, through any mix of groups and direct grants, and it resolves to
`Manager`). So the conflict is **not** caused by having a second way to collect users — groups
are incidental; a *direct* `Manager` grant to a `VIEWER` triggers it identically. It is caused
by the one **subtractive** operator in the picture: the global read-only **cap**, the only thing
that can *disagree* with a floor (survey §3, "only subtraction conflicts"). The new design is
therefore conflict-free **by construction** — all floors — and the entire tension is the seam
between it and the **one inherited cap**, which predates RBAC. The cap is also the only place
"read-only" means *subtraction*: an **object** `Resource Viewer` permission set is a **floor** (grants
view, blocks nothing), while the **global** `VIEWER` is a **cap** (blocks writes). Same word,
opposite mechanism — only the cap conflicts.

**The fork.**

- **A — keep the cap (global role is a hard verb ceiling; current behavior).** Object
  write-roles operate only *within* the user's global role. *Pros:* `VIEWER` is a reliable,
  one-field-auditable read-only **guarantee**; no gate change; fail-safe. *Cons:* object
  Editor/Manager grants are **silently partly-inert** for a `VIEWER` (they get the `OBJ_VIEW`
  part, not edit/manage), and the only way to delegate per-project write is to promote the
  user's **global** role to `MEMBER` — a coarser, anti-least-privilege escalation to achieve a
  fine-grained intent.
- **B — drop the cap (let the all-floors model stand).** Stop enforcing `VIEWER` as a
  write-*blocking* gate; let it be a low baseline floor (`{READ}`), so write-ability comes purely
  from object grants. A `VIEWER` granted Editor on P then writes P. *Pros:* the conflict
  **disappears** — the model is purely monotonic `∪`, object write-roles are meaningful for
  everyone, no special case to ship. *Cons:* you lose the *unliftable* read-only **guarantee** —
  "read-only" becomes a liftable *default* (absence), not a promise. This is the accurate framing
  of "lift the cap": not *teach the gate about object grants*, but *remove the gate*.

**It's a grain mismatch, not a necessary cost.** The conflict comes from read-only living at a
*coarser grain* (a global verb tier) than the write-roles it must compose with (per-object).
Align the grains and it dissolves: if read-only is scoped to the **same grain** as the
write-roles — for instance, separate tiers that govern **disjoint** actions (a coarse-grain
"viewer" and a fine-grain "admin" that never apply to the same action, so they coexist without
either overriding the other), or a purely per-object model with no global tier at all — there is
nothing for a global cap to conflict with. Phoenix's tension is specifically the artifact of a
*global* read-only tier (inherited from before per-resource RBAC) meeting *per-object*
write-roles (new); it is a property of **mixing grains**, not an inherent cost of per-resource
access.

**The collision that makes this load-bearing.** The §1 verb model says `manage` "may be
delegated by a project-manage grant." Under A that promise holds **only for MEMBER+** — a
`VIEWER`'s manage grant is inert — so doc and code currently disagree for read-only users. The
verb-model row is annotated accordingly; this subsection is the decision it points to.

**Recommendation — it reduces to one question: do you need an *unliftable* global read-only
guarantee?**

- **Yes →** keep **A**, but *as a stated choice*: document that object write-roles presuppose a
  `MEMBER+` global role, and that granting one to a `VIEWER` confers visibility only (a footgun
  worth a §3 note once ratified).
- **No →** take **B** (drop the cap), and the entire §2.13 tension **evaporates** — the all-floors
  RBAC ships with no special case, read-only scoped to the per-object grain; "read-only" is then
  an absence-default, liftable by grant.

**Scope boundary (and an existence proof).** This fork *assumes the global role exists* — it
predates this work and gates actions app-wide; the decision here is its **composition operator**
(cap vs. floor), **not its existence**. Eliminating the global tier entirely — pure per-object
grants + admin-by-fiat, read-only as mere absence — is coherent but a wholesale auth redesign,
out of scope like tenancy (§5). It is not hypothetical: at least one mature peer ships exactly a
**pure all-floors, no-clearance** model (every role is an additive bundle; `∩`/`∖` simply don't
exist), so Option B's destination is **known to work in production** — the only thing given up is
the unliftable read-only guarantee. And the *root* of the fork is worth naming: a ceiling is the
cost of making a role a **guarantee** ("read-only no matter what grants accumulate") rather than
a **default** ("read-only until granted more") — worth paying only for *containment* roles, where
a mis-grant must fail safe.

Either way the choice is **independent of the rest of the RBAC design**: the cap is a separate
gate layer, so the all-floors oracle ships unchanged and this is decided on its own — *the one
question above is the whole decision.*

---

## 3. Implementation notes & gotchas

Real, but each has a single settled answer. These are forward-looking guidance for
whoever builds the feature, not properties of `main`.

- **3.1 Grants must key on id, never name.** The mechanical half of §2.4: because
  re-ingestion produces a new id for a same-named resource, any grant keyed on the mutable
  name would mis-target. Reference the durable integer id.

- **3.2 Custom *global* roles collide with an enum-typed column.** On `main`, the
  `user_roles.name` column is typed as a closed set of built-in names
  (`SYSTEM/ADMIN/MEMBER/VIEWER`), so a custom name needs a schema migration. The clean way
  to ship custom **permission sets** without that migration is a **separate permission-set
  table**; shipping custom *global* roles means first migrating that column off the closed
  set. (Phoenix's role model already distinguishes built-in from custom via an
  `is_built_in` flag — the natural seam for this.)

  *Storage is itself a fork, and the `role_permissions` table is forward-compat, not a
  requirement.* The **VIEWER cap and every built-in role check are enforceable from the
  `BUILTIN_ROLE_PERMISSIONS` constant** — no table needed for the closed built-in set. The table
  earns its place only to (a) resolve permissions uniformly with the per-resource side and (b)
  **store custom global roles**, which are runtime-authored and can't live in a constant — and
  even then a *column* on `user_roles` (bitmask / array / JSON) would do; the **join table is a
  normalization choice, not a necessity**. So `role_permissions` is **droppable if custom global
  roles are ruled out**, and its shape — constant / column / join-table — is the sub-fork.

- **3.3 `session_id` is scoped per project, not globally.** `session.id` is client-supplied
  and most commonly `"default"`; resolving by `session_id` alone would link one project's
  traces to another's session. The fix is a composite-unique `(project_id, session_id)`.
  This looks like a pure ingestion-isolation concern, but under containment-based access
  (§2.7) it is **security-load-bearing**: because a session's access is inherited through
  its `project_id`, a cross-project attachment is a cross-project read leak, not just dirty
  data. The integrity of every containment edge is part of the access boundary.

- **3.4 Don't expose a non-global field named `id` on a GraphQL type.** Relay normalizes
  its store on `id` as the canonical global Node ID; exposing a plain `Int` field named
  `id` (e.g. on a permission-set type) crashes the app with a blank page. Name it `role_id`
  (or similar). Applies to any new access-control type on the Strawberry/Relay stack.

- **3.5 The flag flip is a deliberate hard cutover (under the strawman).** This is the
  opposite of the everyone-allow alternative, in which the flip is engineered to be a no-op.
  Under the §1 strawman, enabling the flag **intentionally** makes ingest-born projects
  admin-only —
  non-admins lose visibility to ungranted projects at flip time, by design (flag-*off* is
  unchanged). So the requirement is no longer "changes nothing"; it is "the disruption is
  *known and managed*": surface the blast radius with the §3.9 dry-run **before** flipping,
  communicate, and pre-write the grants teams need. The everyone-allow no-op alternative is
  documented and rejected in §2.1.

  **The dangerous direction is *off*, and an env-var flag gets it wrong.** First, name two
  things the word "flag" conflates: **config/availability** — the operator's intent (an env
  var: "may this deployment run access control?") — and the **enforcement activation state** —
  whether access control is *actually enforcing right now*. The bug is letting the first
  silently drive the second *off*. Once a deployment has restricted data, disabling
  enforcement **silently re-opens every admin-only project to everyone** (roles/grants persist
  inert; enforcement evaporates — §2.10). An ephemeral env var that defaults to "open" is the
  wrong control surface for the *activation state*: config drift, a redeploy that drops the
  var, or a careless flip becomes a mass data-exposure. The fix is *not* strict irreversibility
  (a one-way latch with no escape can brick a deployment whose access control is locking out
  its own admins), but **"easy on, hard and deliberate off, immune to drift."**

  **Status — the latch and its guards are built; only the disable *surface* is open.** The
  prototype implements the read-side at startup in `_ensure_access_control_latch` (the
  facilitator): **(1)** the **activation state lives in the DB** (`system_settings`, key
  `access_control.enabled`), distinct from the env-var availability; **(2)** it is **latched on
  and one-way** — the env var can only ever *bootstrap* the latch on, and a boot where the latch
  is on but the env var is falsey **refuses to start** (the drift guard) rather than silently
  disabling. A companion **auth guard** refuses to start with access-control-on + auth-off
  (enforcement with no identities is a silent allow-all). So **drift-immunity and enable-only are
  done** — and note the runtime check (`enforcement_enabled`) still reads the *env var*, which is
  safe precisely because boot guarantees env-agrees-with-latch-or-no-start. What is **not** built
  remains the open decision: **(3)** an explicit, **admin-authenticated, *audited* in-app
  disable** — today disabling is a *raw, out-of-band edit of the `system_settings` row before
  startup*: deliberate, but unaudited and undocumented; and **(4)** a documented **break-glass**
  disable path (loud audit trail) for the genuine locked-out case — **there is no break-glass
  surface today.** So the open residue is narrow: the *disable UX and its audit trail*, not the
  latch model itself (§1).

- **3.6 SYSTEM is the one identity exempt from "fail closed," by design.** A normal user
  resolves to *no* permissions on an invalid claim set (the oracle fails closed); the
  SYSTEM user is constructed directly with the SYSTEM role and no claim validation, because
  the gate is the admin-secret comparison upstream. This is correct, but it makes SYSTEM a
  singleton trust anchor with total blast radius — the design leans on there being exactly
  one. Anything wanting "another automation identity" must go through service accounts
  (§2.5), never a second SYSTEM-role user.

- **3.7 Coverage is the hard part — keep an inventory of access-derived operations.** §2.7
  warns that the risk is surface-area, not mechanism: the ACL model is small, but *every*
  operation that returns or acts on access-derived data must carry the same predicate, and
  for Phoenix that set is large and easy to under-count. One missed endpoint is a silent
  leak no model-level test will catch. Maintain an explicit inventory and confirm each
  applies the oracle's filter — at least: **list** (paginated reads), **point-get** (by
  id), **project resolution by name during ingest** (the authorization/creation check of
  §2.2 — *not* namespace isolation, which is the §5 tenancy concern), **write / bulk write**,
  **delete**, **count**, **aggregate / metrics / dashboards**, **export / download**,
  **subscription / streaming**, **autocomplete / typeahead**, and **transfer / move**
  (§2.9). A *second* predicate compounds this: every project-surfacing read must also apply
  the **hide-internal** filter (`exclude_experiment_projects`,
  `exclude_dataset_evaluator_projects`), and the hidden experiment/evaluator projects need
  **access-by-parent**, not the ordinary baseline (§2.8) — so internal/shared projects must
  never be swept under the default project rule without an explicit decision. The honest
  expectation: for Phoenix, getting *coverage* right is harder and more
  bug-prone than getting the *access model* right, because the model lives in one module
  while coverage is spread across every read path in the API.

  The hottest version of that predicate needs a concrete query plan before rollout. For
  child-heavy tables (spans, traces, sessions), `child.project_id IN (accessible_project_ids)`
  is the conceptual shape, not a license to materialize a huge Python list on every request.
  The implementation should use the database shape that fits the caller: an admin fast path
  with no ACL join, a semi-join / `EXISTS` against grants for ordinary users, or a bounded
  materialized id set only where the cardinality is small and measured. The flag-off no-query-
  cost claim is also an invariant to test: when enforcement is off, hot span/trace queries
  should not pay for ACL joins or accessible-id computation at all.

- **3.8 Access control presupposes authentication — enforce that precondition loudly.**
  The oracle grants on *identities* (§2.10); an anonymous, auth-disabled instance has none,
  so there is no subject for the oracle to evaluate and access control cannot function
  there at all. (This is distinct from the `everyone` subject in the model — an
  auth-off request carries *no* identity to resolve, not "the everyone identity.") The trap
  is an operator enabling the flag on an auth-off deployment and *believing* it is secured
  when in fact nothing can be restricted, because there is no one to restrict *against*. The
  flag must therefore never be silently "on but ineffective." For a
  *security* flag the right default is to **fail closed on misconfiguration: reject it at
  startup** (refuse to boot with access-control-on + auth-off), so the operator cannot
  mistake an open instance for a secured one. Downgrading to "no-op with a loud, repeated
  warning" should be a deliberate fallback chosen only for a strong backward-compatibility
  reason, not the baseline behavior. Either way, adopting access control on an open instance
  is gated on the strictly larger auth migration underneath it.

- **3.9 Build the dry-run preview before the first rollout.** §2.10 names this the
  highest-leverage rollout investment; it should be an actual deliverable, not a footnote.
  The capability — "given the current grants, who would lose access to what the moment the
  flag flips (or this grant lands)?" — is derivable from the existing oracle
  (`subjects_for` / `accessible_scope`) with no enforcement change, e.g. a
  `preview_access_changes` query. Under the strawman the flip is a *silent mass restriction*
  (non-admins' ungranted projects disappear all at once — ingestion itself does not break,
  §2.2), so surfacing that blast radius *before* the flip is worth more than any amount of
  after-the-fact auditing.

- **3.10 Support needs an audited explainability path under not-found semantics.**
  Unauthorized-≡-not-found is correct for end users (§2.10, and the §4 realization row) but
  creates an operational bind:
  when a user reports "I can't see project X," support must diagnose it without casually
  confirming to that user that X exists. This is distinct from raw SYSTEM access — the
  answer is an **admin-only "why can't this user see X?" path**, built on the same oracle
  machinery as the §3.9 preview, and itself **audited** under the §2.6 rule that every
  privileged read leaves a record. Without it, the only ways to debug an access complaint
  are to leak existence to the user or to hand a human the SYSTEM/admin secret — both bad.

- **3.11 Decide the base audit log before arguing about history.** The survey separates
  the audit query ("who can see X?"), the change log ("how did access become this?"), and the
  action log ("who did what?"). The support path in §3.10 and every SYSTEM-mediated read in
  §2.6 already require at least a base **action log** for privileged reads/writes: who,
  credential, action, resource, time, result, and reason. That base log must be settled
  before launch — decided in scope, or its absence explicitly accepted — rather than deferred
  as a compliance nicety, because unaudited privileged reads are exactly the paths the design
  otherwise asks users to trust.

  Point-in-time audit is the larger conditional requirement. The survey's change-log unit is
  *effective-access change*, but support and compliance often ask "who could see X **at time
  T**?", not just now — and the answer drifts as groups, roles, and grants all change over
  time. Answering it requires either periodic **effective-access snapshots** or enough
  **event history** to reconstruct effective access at an arbitrary past instant. This carries
  real storage/retention cost, so treat it as conditional: decide up front whether
  point-in-time answers are a requirement, because retrofitting the history after the fact is
  impossible — the events that were not recorded are gone.

- **3.12 Group provisioning is three sources over one schema — and the `provider`
  namespace is what makes that safe.** A group becomes useful as a grant subject only once
  it is *populated*, and there are three ways that happens, addressing three deployment
  shapes:
  1. **Login-time IdP sync** (the default; the prototype's `sync_user_groups`) — at each
     OAuth2/LDAP login a user's memberships are reconciled to the IdP's *current* group
     claims. Simple, but **reactive**: a removal in the IdP takes effect only on that user's
     *next login*, so the **revocation budget is effectively unbounded** (a user who never
     returns keeps their access — the unbounded-revocation hazard of survey §12). Groups also
     exist only for users who have logged in, so you cannot grant to a team before it onboards.
  2. **SCIM** (deferred, the enterprise tier — survey §10/§16/§17) — the IdP *pushes*
     user/group create/update/**delete** out-of-band of login, which is the only thing that
     makes **deprovisioning prompt** and lets groups exist before first login. SCIM is a
     provisioning *transport*, not a change to the access model.
  3. **Local/admin-managed groups** — created and populated by an admin in-product, the
     **only** option for a deployment with no IdP at all (basic-auth-only); login-time sync
     and SCIM both require an IdP, so neither helps here. The prototype does **not** yet
     offer this; today a no-IdP deployment can grant **per-user only**.

  The load-bearing design point: the `user_groups.provider` column **namespaces** each
  source (`oauth2:<idp>`, `ldap`, `scim`, `local`), and the login reconcile is
  **provider-scoped** — it only ever deletes memberships *within the provider it is syncing*.
  So the three sources coexist without clobbering each other, SCIM can be added later as just
  another provider **with no schema change**, and local groups are immune to being wiped by
  an IdP login. The one rule that prevents a double source of truth: **if SCIM provisions a
  directory, disable login-time claim-sync for that same provider** — SCIM owns the
  directory, login only authenticates. And provisioning *deletes* (a SCIM user/group DELETE,
  or a local-group delete) must run the same dangling-grant cleanup as §2.12 — deleting the
  subject's `acls` rows — or a recycled id silently inherits the old grants.

- **3.13 Grant-side revocation should be next-request unless deliberately cached.** §3.12
  names the unbounded revocation budget for login-time group sync, but grant rows themselves
  should have a tighter default: deleting a direct grant, removing a user from a local group,
  or changing a permission set should affect the next authorization check. That follows
  naturally if `can` / `accessible_ids` read DB state per request and do not cache effective
  access across requests. If a later optimization introduces request-external caching
  (flattened accessible-id sets, token-embedded grants, cross-request LRU), the cache TTL
  becomes part of the security contract and must be bounded by an explicit revocation budget.
  Until then, document the invariant as **grant revocation is next-request; IdP revocation is
  only as fast as the provisioning source**.

---

## 4. Proposed realization (prototype)

For reference, how the prototype maps the survey's concepts onto Phoenix. **None of this
is on `main`** — it is the current direction, subject to change, included to make §2 and
§3 concrete.

| Survey concept | Proposed Phoenix realization |
|---|---|
| Family A (stored edges) | a generic `acls` table; list query is `grant rows → ids → IN (...)` |
| Single oracle | one access module exposing `can` / `accessible_ids` / `subjects_for` |
| `authority(identity) ∩ attenuation(credential)` | applies to **read / non-ingest** surfaces: a credential's read access = its identity's grants ∩ an attenuating `scope`. It does **not** gate ingestion writes — under the strawman those are ungated (§2.2); a key's `scope` may still bound its non-write capabilities (read, verb-level), not project write authorization. |
| Subject union | a `subject_kind` discriminator (`user`/`group`/`everyone`; `service_account` reserved, §2.5). **Note:** `everyone` exists as a subject for *explicit* grants (deliberately sharing an object with all users); it is **not** a seeded deployment-wide open baseline — the strawman has no open seed, so do not reintroduce the rejected everyone-allow model by auto-creating an `everyone` grant. |
| Group as grant subject (Pattern 1) | user-group + membership tables, grantable on objects |
| Roles as data | global role + permission tables (built-in only at first); a separate permission-set table for custom permission sets |
| New-resource default visibility | **Strawman (§1):** fail-closed per type — ingest-born **projects → admin-only**, user-created **datasets/prompts → creator-private**. No seeded everyone-allow grant. (The everyone-allow alternative's all-types-open seed is rejected — §2.1.) |
| Eval-world plumbing & playground (§2.8) | A server-set, immutable **`kind`** discriminator (`TELEMETRY`/`PLAYGROUND`/`EXPERIMENT`/`EVALUATOR`) marks *plumbing vs real project*, replacing today's name-pattern + `exclude_*` heuristics. **Settled:** experiment/evaluator trace-projects are plumbing — access is **rooted at the run's data context** (the dataset), not an independent grant. **Provisional (online-eval workstream, not `main`):** the *production-project-as-data-context* root and the preference for rooting at the *run* over a denormalized `project.dataset_id` come from the concurrent online-eval design — reconcile before building (§2.8 header note). **Open:** playground — lean per-user `kind=PLAYGROUND` projects + creator grant (§2.8). |
| Ingestion-time creation authority | **Strawman (§1):** *settled* — any authenticated ingest key may create/write any project; creation exposes no read access (admin-only default), so creation is deliberately ungated. Partial batches are never rejected for authorization while writes are open (§2.2). |
| Unauthorized read ≡ not-found | point checks return not-found for unreachable objects |
| Monotonic allow-only (strawman) | every row is `effect = allow`; default is **closed** (admin-only), so grants only *add* — no shadowing, no `restricted` marker; last-grant removal leaves an object admin-only, never reopened. (The non-monotonic everyone-allow alternative and *why* it's rejected: §2.1.) |
| ADMINISTER override | resolved as a rule inside the oracle, not a call-site shortcut |

---

## 5. Tenancy: the structural direction

Everything above is per-resource access control *within* a flat, global project namespace.
The recurring subtext — and the clearest finding when Phoenix is compared with mature
multi-tenant peers — is that the deepest tensions are **symptoms of `project` being a
top-level resource with nothing above it.** A **tenant layer** (a container such as a
*space*, itself inside an *org* / *account*, with `project` and the other resources living
*inside* it) is the structural fix. To be clear up front: this does **not** make tenancy a
prerequisite for the per-resource RBAC of §1–§4 — that proposal ships on its own. Tenancy
changes the preferred *defaults and creation model* later; it is an evolution, not a gate.
This section states the direction and its trade-offs;
it is **not** the tenancy design — the org model, provisioning (SSO/SCIM), data isolation,
and migration mechanics are a follow-on.

**Status.** Unlike the rest of this doc, tenancy is **not prototyped** — there is no tenant
layer on `main` and none in the working-tree prototype. Treat §5 as a recommended
direction, not a description of something that exists.

**The core mechanism.** A container with members gives a machine-created resource
*something to inherit*. The pipeline writes *into* a space (selected by the credential,
routing context, or a future tenant-scoped ingest configuration — undesigned),
and the space's access governs by default, with resource-specific grants adding access from
there. That single change is what dissolves the birth-cluster tensions — they exist
only because, today, a project has no parent.

Tenancy is **two-sided**: it ameliorates the *design* (birth) pains and exacerbates the
*operational* ones.

### What it ameliorates — the Birth-and-creation cluster

- **§2.1 default visibility** — the default gains a *scope*: "visible to the owning space's
  members," which is neither global-open nor global-private. The fail-open/fail-closed
  dilemma dissolves into "inherit the container."
- **§2.3 ownership without a creator** — *strongest effect.* An auto-created project lands
  inside a space that already has members and inherits its access; no owner need be
  manufactured. "Governed, not owned" becomes the literal model.
- **§2.4 recreated same-name** — a re-ingested resource re-lands in the same container and
  inherits the same **container default** access, so continuity comes from the container
  rather than from re-attaching id-keyed grants (direct restrictions still don't carry to
  the new id).
- **§2.2 creation authority** — *ameliorated but relocated.* The "create a new world-visible
  project under a different name" bypass shrinks (creation requires write to a space, and
  the result inherits space access, not global visibility) — but the fork climbs a level to
  **"who may create a *space*?"**, which the tenancy design must answer.

### What it exacerbates — the operational cluster

- **§2.9 moving across boundaries** — a *new, harder* class appears: cross-tenant moves
  (project between spaces, space between orgs). These are the hardest authorization case —
  two-sided rights across a boundary whose entire purpose is to prevent data crossing it.
  The likely answer is to **forbid** cross-tenant moves rather than secure them.
- **§2.10 rollout** — introducing a container layer where there was none is itself a
  *structural* migration, larger than the access-flag flip: every existing project assigned
  to a space, every user mapped to space/org memberships, and — the breaking change —
  **ingest routing must carry container context** (a span no longer names a global project;
  it resolves to a project *within* a space, which the key determines). Existing collector
  configs may need updating.
- **§3.7 coverage** — the bar rises and gains a second dimension: tenant isolation. *Every*
  query must be tenant-scoped, not just the access-derived read surfaces — a hard boundary
  whose violation (one tenant seeing another's data) is the worst case. This is a distinct,
  even less forgiving, coverage obligation layered on top of the per-resource one.

### Net

Tenancy is **the cure for the birth pains and the cause of the operational ones.** It is
adopted to make unattended, ownerless ingestion tractable — the pipeline writes into a
container with a pre-existing access model — and paid for in a one-time structural migration
and a tenant boundary that every read must thereafter respect. It is the right long-term
move precisely because it converts the hardest *design* questions (§2.1/§2.3/§2.4) into
inherited behavior; it is deferred to its own pass precisely because the *operational* cost
(§2.9/§2.10/§3.7) and the surrounding product decisions (deployment model, provisioning) are
large enough to deserve dedicated treatment rather than being folded in here.

---

## 6. Global objects outside the containment tree

§2 models the world as a **containment tree** — resources under projects (and datasets and
prompts), governed by grants plus downward inheritance (§2.7), with system-generated
projects as a wrinkle (§2.8). But Phoenix's schema also has a **global layer**: objects that
belong to *no* project and are reused across the deployment. The access model is silent on
them, and they do **not** fit "containment + per-resource grant." They come in three shapes,
each with different access semantics — and a fourth note on credential carriers.

*(Provenance: the table names below were verified against `main` (as of 2026-06) and carry
no line citations — re-verify against current code before building, as with the rest of §2.)*

**1. Secrets — the most sensitive object, with unique semantics.** The `secrets` table is a
deployment-global key→encrypted-value store holding **third-party credentials** (model-provider
API keys and the like); credential-bearing config blobs such as a custom model provider's
connection `config` are the same class. The invariant is about the **value**, not the row:
a secret's **value is never returned, echoed, logged, or exposed through an error** — it is
write-only from the API's perspective, and admin-gated to set. Its **metadata** (the key /
name / handle, who set it, when) *may* be listed where the UI needs to show which secrets
exist — that is a normal admin-gated read, not a value disclosure. This is distinct from
Phoenix's own auth keys (§2.5, which are *credentials* the system issues); secrets are
*foreign* credentials the system *stores*. The value is the single most access-sensitive
datum in the schema and the clearest current gap.

**2. Shared "library" objects — restricted-write, read policy *per type*, not contained.**
Globally unique, reused across the tree, fitting neither containment nor a per-object grant:
**evaluators** (the reusable evaluator library, linked to datasets via dataset-evaluators —
distinct from the hidden evaluator *projects* of §2.8), **annotation configs** (shared
annotation *schemas* attached to many projects), **global model definitions and pricing**,
and **dataset/prompt labels** (globally-unique labels applied across many resources). Their
access question is two-sided and unlike the tree's: **create/edit is admin-or-author**,
while **read/use is a per-type policy decision, not a blanket rule** — many (labels, pricing,
built-in evaluators) are reasonably "anyone in the deployment," but some (a custom evaluator
carrying a proprietary prompt) may warrant tighter read. The point is that these objects need
*a* read decision made per type, not that they are all open. Neither side is a grant on a
contained object. (A mature peer makes several of these — evaluators,
annotation configs, labels/tags — *first-class resource types*, which is evidence they
deserve explicit treatment rather than silence.)

**3. Admin / global config — privileged writes, one of them destructive.** **Trace
retention policies** govern data *deletion* (a cron + rule applied across many projects), so
"who may set retention?" is a privileged action with destructive consequences and deserves
the same care as a delete grant. **System settings** and **sandbox/execution config** are
admin-only (the latter possibly credential-bearing, see shape 1).

**4. Credential carriers (not resources, but must-not-leak).** The concrete auth artifacts —
refresh tokens, access tokens, password-reset tokens — are the physical form of §2's
identity/credential split. They are not grantable resources and need no grant model, but
they must never leak; worth one line so they are not mistaken for ordinary rows.

The throughline: the containment tree is most of the model but not all of it. Separate the
two parts — the **security invariants are settled** (non-negotiable now), only the
**policy/UI treatment is open**:

- **Settled invariants:** a secret's *value* is never returned, logged, or echoed; auth
  tokens never leak; trace-retention *writes* are privileged (destructive). These are not up
  for debate — only their enforcement is implementation work.
- **Open policy:** the per-type *read* decision for the shared library; secret/token
  *metadata* listing UX; which roles hold the privileged config writes.

Secrets (shape 1) are the priority among the invariants, because the failure mode — a
foreign credential **value** leaking through a response, log, or error — is the worst in the
schema.
