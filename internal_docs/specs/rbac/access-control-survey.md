# Access Control: A Survey of Approaches

A consolidated reference on per-resource access control: the conceptual model (how
users, groups, roles, permissions, resources, and tags relate), the two architectural
families this produces, how comparable products implement them, and the design
considerations that follow. Intended to give a shared vocabulary and mental model before
design discussions, so they argue trade-offs rather than talk past each other.

**Scope — read this as framework + datapoints, not exhaustive coverage.** This is a
**conceptual framework plus four peer profiles in our category** (observability / ML-adjacent
tooling) — *not* a complete map of the field. It does **not** survey relationship-based access
(ReBAC / tuple-store systems), external policy engines (OPA / Cedar), or cloud-native RBAC
(AWS IAM, Kubernetes); those are *related families* — touched on in §4 — deliberately out of
scope. Treat the vendor profiles as datapoints that illustrate the framework, not industry-wide
truth.

**Anonymization.** Peer products are referred to as Vendor A–D. The public-facing
profiles intentionally describe architectural shape rather than product names or exact API
schema. They are reconstructed from public documentation and observed behavior **as of
2026-06**; some systems are closed-source, so implementation details are directional —
**re-verify against current product docs before relying on a profile or citing it externally.**

---

## Key Findings

- **Listing drives the architecture.** Point checks centralize easily; list queries decide
  whether the model can be enforced before pagination and at scale.
- **Stored edges are the common baseline in this survey.** All four products store coarse
  access as membership, scoped-permission, or ACL rows the database can traverse.
- **Attribute predicates appear only as a narrow refinement.** The predicate-based peer
  gates on curated server-managed tags below workspace RBAC — not arbitrary resource
  content or telemetry.
- **Groups reveal the product shape.** Systems either grant directly to groups as
  subjects, or use identity-provider groups as inputs to tenant role assignment. That
  choice tracks whether the product is object-grain or workspace-grain.
- **Allow-only remains the safer default** — *not* "never deny." Contractor walls,
  regulatory segregation, and break-glass are legitimate deny use cases; explicit deny
  still changes query shape, explainability, and audit enough to require deliberate design
  (§11), not a column added and discovered later.

---

## Table of Contents

**Foundations**

1. [The Question, in Three Shapes](#1-the-question-in-three-shapes)
2. [A Working Vocabulary](#2-a-working-vocabulary)
3. [The Conceptual Model: Entities as a
   Graph](#3-the-conceptual-model-entities-as-a-graph)
4. [Two Families: Stored Edges vs Computed
   Edges](#4-two-families-stored-edges-vs-computed-edges)
5. [The Effective-Access Formula and the Single
   Oracle](#5-the-effective-access-formula-and-the-single-oracle)

**The Landscape**

6. [Vendor Profiles](#6-vendor-profiles)
7. [How Groups Relate to Access](#7-how-groups-relate-to-access)
8. [Roles and Custom Roles](#8-roles-and-custom-roles)
9. [Tenancy and Isolation](#9-tenancy-and-isolation)
10. [Identity Provisioning](#10-identity-provisioning)

**Design Considerations**

11. [Expressing Exceptions: How Systems Say
    "No"](#11-expressing-exceptions-how-systems-say-no)
12. [Behavior Under Change](#12-behavior-under-change)
13. [Matching Facts to Carriers](#13-matching-facts-to-carriers)
14. [Auditing: the Record vs the Decision](#14-auditing-the-record-vs-the-decision)
15. [Comparison Matrix](#15-comparison-matrix)
16. [Cross-Cutting Findings](#16-cross-cutting-findings)
17. [Implications for Design](#17-implications-for-design)
18. [A Decision Checklist](#18-a-decision-checklist)

---

## 1. The Question, in Three Shapes

All access control exists to answer one question:

> Can **this subject** perform **this action** on **this resource**? → allow / deny

Easy to state, but it arrives in three shapes with very different costs:

1. **The check** — "Can Alice read project X?" → yes/no. Every design answers this
   cheaply.
2. **The list** — "Alice asked for all projects; which rows come back?" This is not a
   yes/no — it is *filtering a table*, and it must happen **inside** the SQL query. (The
   tempting shortcut — fetch rows, then check each — breaks pagination and fails at
   scale.)
3. **The audit** — "Who can see project X?" The shape that is forgotten until the first
   compliance review or a "Sharing" dialog needs it.

**The list is the question designs are really built around.** When evaluating any
access-control proposal, ask first: *what does the list query look like?* That one
question reveals which family (Section 4) you are looking at.

---

## 2. A Working Vocabulary

Built up in four layers; this is the canonical vocabulary used throughout.

**Layer 1 — who is asking.**
- **Identity** — the durable actor that *has* authority on paper: a user, or a service
  account.
- **Group** — a reusable *set of subjects*, so access is not granted one identity at a
  time. A **junction vertex** like a role (§3, "one primitive — four knobs"); the knob
  settings differ.
- **Credential** — the artifact presented to prove it: a browser session, or an API key
  pasted into a collector config months ago.
- **Subject** — what the server sees on a request: *an identity, as wielded through a
  credential.* The same identity through two credentials can be two subjects. This split
  matters because **credentials travel and outlive moments** in ways identities do not —
  most real incidents are credential stories. A system that collapses the two (a key
  simply *is* its owner, with all of the owner's power) inherits a class of problems
  from that collapse.

**Layer 2 — what they may do.**
- **Authority** — everything an identity could do: the full set of (action, resource)
  pairs.
- **Grant** — a *stored row* that produces authority ("Alice has Editor on X").
- **Policy** — a *rule* that produces authority ("checkout-eng may read anything tagged
  `team=checkout`").
- **Permission** — one element of authority (one action on a set of resources).
- **Role** — a **named junction vertex** in the access graph (§3): its *incoming*
  edges say who holds it, its *outgoing* edges say what it grants. Products *usually*
  package a permission bundle into it — a **product choice, not the essence** (§3, "one
  primitive — four knobs").

Grants and policies are the two possible *sources* of authority — the distinction that
produces the two families.

**Layer 3 — doing less than you could.**
- **Attenuation** — a credential carrying *less* authority than its identity (an admin
  minting an ingest-only key for a collector). The golden rule: **attenuation only ever
  narrows** — a credential can never out-rank its identity.

**Layer 4 — where facts live.**
- **Carrier** — every authorization-relevant fact (a grant, role, scope, tag) physically
  lives somewhere: a database row, a signed token claim, a resource tag, a request
  header, a code constant, a cache.
- **Binding strength** — *who can change or shed this fact, and how fast do changes take
  effect?* A signed claim cannot be altered by its holder; a tag can be edited by
  whoever edits the resource; a self-reported header can be omitted; a cache holds a
  stale copy until it expires. The single most useful discipline: **match a carrier's
  binding strength to the fact's security weight** (Section 13). *One caveat on the axis:*
  binding strength ranks **mutability and revocation latency**, not tamper-resistance under
  breach (§13).

Two pairs that sound alike and are not:
- **Default-deny vs explicit deny.** Default-deny = "no grant found → no access"; every
  system has it. Explicit deny = "a rule that blocks even when another rule allows";
  rare, and expensive (Section 11).
- **Guardrail vs boundary.** A *boundary* holds against an adversary (the constrained
  party cannot shed it). A *guardrail* protects a cooperating-but-fallible party and is
  escapable by construction. Confusing them ships a seatbelt as a cell wall.

---

## 3. The Conceptual Model: Entities as a Graph

The cleanest way to see how the entities relate is as a graph, where access is a
**reachability** question. This is not a stretched analogy — the largest-scale production
systems (relationship-based / **ReBAC** stores) **model access as a graph** and answer every
check as a **bounded walk**. (ReBAC as a family is out of scope here; this doc borrows only
its mental model — see §4 for when to reconsider.)

> Can subject **S** do action **A** on resource **R**? ⟺ **Is there a path from `S` to
> `R` over edges that permit `A`?**

Allow = a path exists. Deny = no path (or a blocking edge along the way).

**The vertices** (the nouns):

| Vertex | Examples |
|---|---|
| Subject | a user (often via a session), an API-key-wielded identity, a service account — an API key is a vertex only if modeled as its own identity rather than a credential |
| Group | a team / group of subjects |
| Role | a named junction vertex, usually carrying a permission bundle for a resource (e.g. `editor`) — the bundle is the common preset, not the essence (see "one primitive, four knobs" below). *Caveat:* a **global** tier (`admin`/`member`/`viewer`) used as a clearance is **evaluation context, not a graph vertex** — see "What is *in* the graph" below. |
| Permission | `read`, `write`, `delete` (sometimes a vertex, sometimes an edge label) |
| Resource | org → project → trace → span; also dataset, prompt, experiment |
| Tag value | `team=checkout`, `env=prod` (only in the attribute world) |

**The edges** (the verbs that connect them):

```
 user     ──memberOf──▶     group
 group    ──hasRole───▶     role
 role     ──grants(read,write)──▶  a resource, a resource type, or a permission
 resource ──childOf───▶     resource     (containment: span ▸ trace ▸ project ▸ org)
 resource ──taggedWith──▶   tag value    (only in the attribute world)
 user     ──ownerOf───▶     resource     (creator gets a grant)
```

A **policy** is a rule about which edges count. A **check** walks the edges. A **"what
can Alice see?" list query** walks *all* edges out of `Alice` and collects every
resource vertex it reaches.

### Why roles and groups exist: edge-count compression

This is the core functional relationship. Without a role, you connect every subject
directly to every permission they need — a complete bipartite mess of `N × M` edges.
Insert one **role** vertex in the middle and it collapses to `N + M`:

```
   WITHOUT roles  (N×M edges)        WITH a role vertex  (N+M edges)
   u1 ─┬─▶ read                       u1 ─┐                ┌─▶ read
   u1 ─┼─▶ write                          ├─▶ role:editor ─┼─▶ write
   u2 ─┼─▶ read                       u2 ─┘                └─▶ delete
   u2 ─┴─▶ write
```

**Groups do the same trick on the subject side** (many users → one group → …). So in
graph terms, role-based access control is just: *insert intermediate vertices to trade
`N×M` edges for `N+M`.* Every role and every group is a reusable junction.

This also names the relationship precisely:

- A **group** answers *who* (a set of subjects). A **role** answers *what bundle* (a set
  of permissions). They sit on opposite sides of the graph. *(This is the common **preset**,
  not a categorical line — more precisely both are the same primitive with different knobs;
  see "Roles and groups are one primitive" below.)*
- An **assignment / grant** is the single edge that connects a *subject (or group)* to a
  *role*, optionally *on a resource*. That edge is the only place the two sides meet.
- Resolution walks it back out: a user inherits their groups' assignments → each
  assignment expands to a role → each role expands to permissions → the permission is
  checked against the resource.

Neither grouping is redundant: groups collapse the *user* axis, roles collapse the
*permission* axis, and you need both to get one assignment to mean *(all members) × (all
permissions)*. Tags (below) extend the same idea to a third axis — *which resources* —
replacing "name the object" with "any object matching a rule."

### The access edge, precisely: who / how / what / which

Zoom in on a single grant. It is one **colored, directed edge**, with exactly four degrees
of freedom:

```
        subject  ──[ color ]──▶  object
        (who)        (how)        (what)
                      resolved by ──┴── which   (applies to BOTH ends)
```

- **who** — the subject end: a user, a group, `everyone`.
- **how** — the edge's *color*: the permission level (`read` ⊆ `write` ⊆ `manage`), a
  partial order.
- **what** — the object end: a project, dataset, prompt, or `everything`.
- **which** — *how each endpoint resolves to concrete vertices*, and it applies to **both**
  ends: `all`, `none`, an explicit `list[id]`, or a **predicate** (membership; or a
  tag/attribute match).

The `which` axis is the unifier: a **group** is a `which` on the *subject* end; a **tag rule**
is a `which` on the *object* end — the same mechanism on opposite ends (Family B below is
"move the predicate from subject to object"). List queries must evaluate or join the predicate
against candidates — cheap on **indexed, server-managed attributes**, expensive on computed or
non-indexable content; object-side predicates are the harder case.

### Roles and groups are one primitive — four knobs, not two categories

The "*group* answers who, *role* answers what" split above is the common **preset**, not a
categorical difference. Both are **reusable junction vertices**: *a named set that expands
into edges* (the `N×M → N+M` trick, applied to different ends). The precise model is **one
primitive** — a named set on an edge — with four independent knobs; "role" and "group" are
just two corners of that space:

| Knob | "role" preset | "group" preset |
|---|---|---|
| Which end it reuses | the `(color × object-type)` bundle | the subject set |
| Where capability lives | packaged into the definition | supplied by external grant edges |
| Cardinality per subject | often exactly one, total | zero-or-many, optional |
| Composition operator | sometimes `∩` (a cap) | `∪` (additive) |

A *custom global role* and *a group holding a wildcard grant* are **the same machinery** with
different knob settings — no clean yes/no at the model level. **Cardinality**, **where
capability lives**, and downstream lifecycle/UI differ in practice; only the **operator** knob
(floor `∪` / cap `∩` / deny `∖`) changes *what is safe*. *Extensionally* both classify users;
**defining payload is dual** — permissions vs users — same junction, dual element-types.
Parallel **`member_*` fields** encode that duality. **Read the knobs, not the labels.**

### Composition: ∪, ∩, ∖ — and why a "ceiling" is not a "deny"

A subject belongs to many sets at once (itself, its groups, its role, `everyone`). Their
bundles compose with exactly three set operators, and *which operator each construct uses* is
the entire security character of a model:

```
  access(U)  =  ( ⋃ positive edges from every set containing U )   — grants / groups: additive
                ∩  ceiling(U)                                       — a cap (e.g. read-only)
                ∖  denials                                          — an explicit "no"
```

A concrete instance for each operator. Say Alice has a personal `read` grant on a project and
is in a team granted `write` on it:

- **`∪` (grant + grant):** `read ∪ write = write`. Two reaching edges combine to the *more*
  permissive — adding the team grant only ever raised her access.
- **`∩` (cap):** she uses a read-only API key. `write ∩ read-only = read`. The cap *clips* the
  result down, but it is a property of the key, known before any project is consulted.
- **`∖` (deny):** an explicit `deny write on this project` row would override both grants —
  `write ∖ {write} = read` — but only after scanning that project's edges to discover the deny
  exists.

`∪` is the only **monotonic** operator (adding an edge never *removes* access). `∩` and `∖`
both subtract — but they differ in **knowability**, and conflating them is a common error:

- A **ceiling** (`∩`) is a **scalar on the subject vertex** — a clearance (`viewer ≤ read`).
  It is known from the *subject alone*, O(1), before any object edge is read, and it is
  **monotone-preserving**: a fixed `min` in the evaluation function, not a member of the edge
  set, so adding edges to a capped subject still only ever *grows* access (up to the cap). A
  ceiling is a fact about *who the subject is*.
- A **deny** (`∖`) is a **negative edge in the graph**, aimed at a specific object. It can
  only be found by *scanning that object's edges*, it breaks the "find one allow and stop"
  shortcut, and adding one *reduces* access (non-monotonic). A deny is a fact about *an
  object*.

The two are extensionally interchangeable for a uniform cap (`A ∩ {≤read}` = `A ∖ {>read}`)
but operationally opposite. The consequence: **a system can offer a hard read-only role
without any deny edges** — represent the cap as a subject clearance, not a negative edge — and
so keep a purely monotonic, allow-only graph. Reach for true deny only when the "no" is
genuinely *per-object* and cannot be expressed as a subject-level cap (§11).

**Most systems implement a *subset* of `∪ / ∩ / ∖`.** This formula is the general space, not a
spec. The simplest defensible model is **`∪` + absence + one fiat admin**: positive edges
only, every "no" is a missing edge (fail-closed), and a single superuser by fiat — no `∩`, no
`∖`. A cap (`∩`) earns its place mainly for **credential attenuation** (a key that tracks its
owner's *dynamic* authority minus a fixed narrowing — the one thing absence cannot express
without copying edges). True deny (`∖`) is for genuinely per-object exceptions (§11). Note a
cap belongs only on a *single per-subject clearance* (a global role, a credential scope) —
**never on a group**, or joining a group could *reduce* access (a non-monotonic "restriction
group"). Which subset a system picks is one of its defining choices.

**Corollary — only subtraction conflicts.** **Additive sources never disagree** — `∪` is
order-independent and monotone, so any number of grant sources compose without conflict.
The *only* thing that can disagree with a grant is a **subtractive** operator: a `∩` cap or a
`∖` deny. **Conflict tracks the number of subtractive operators, not the number of sources.**
If two authority sources "fight," one is a cap or a deny — find *it*, not the grants. (An
all-`∪` model is conflict-free by construction; every "which source wins?" question is really
about a cap or a deny.)

### Absence vs. arriving color

In a fail-closed, allow-only graph a "viewer" is often defined by the **absence** of
higher-color edges: they hold no `write` edge, so they cannot write. This works — but only
for edges the subject **emits**. It does **not** govern colors that **arrive** through paths
via other vertices:

```
   U ──member──▶ G ──[write]──▶ P     U inherits write on P through G,
   (emits no write edge)              though U itself emits no write edge.
```

Absence is local to a subject's own edges; reachability is global. To guarantee "U can
*never* write, even via a group," you need something *at U* that filters **arriving** colors
— a clearance clamp on the node (`delivered = min(path color, node cap)`), i.e. the `∩`
ceiling above, **not** a deny edge. So there are two distinct "viewers":

- **viewer-by-absence** — emergent, monotonic, *liftable* by a group grant; a description of
  the current edges, not a guarantee.
- **viewer-by-clamp** — a subject clearance clipping arriving colors; *unliftable*. The price
  of the guarantee is one scalar — still not a deny.

### Admin: "by fiat" is just topology with two flags

A superuser implemented "by fiat" (`if is_admin: allow`, skipping the walk) is
**extensionally identical** to a subject holding wildcard, max-color edges to every object.
Fiat-vs-topology is a representation choice, not a semantic one. The fiat encoding carries
exactly two properties, both expressible as edge flags:

- **axiomatic** — the edges hold even if the edge store is empty or broken, so the recovery
  path cannot be bricked by bad data;
- **deny-immune** — they survive the `∖` term, so a misconfigured deny cannot lock the admin
  out.

The admin is therefore not "outside the graph" — it is the **maximal vertex inside it**,
holding guaranteed, irrevocable edges. A fail-closed system needs exactly one such actor, or
a single bad rule could lock everyone out with no way back in.

### What is *in* the graph, and what is evaluation context around it

The graph answers exactly one question — **reachability**: can a subject reach a resource over
permitted edges? That makes it the right model for the *relational* concepts and the **wrong**
model for several others. Drawing the boundary explicitly heads off a recurring error
(trying to make vertices and edges express things they structurally cannot):

**Inside the graph** — walked at decision time: **subjects** (users, service accounts,
groups, `everyone`), **resources** and their **containment**, the **permission/color** on each
edge, and the **grants / assignments / permission sets** that *are* those edges. Roles and
groups are junction vertices here.

**Evaluation context *around* the graph** — not vertices or edges; they parameterize *how* a
walk is evaluated, and the graph cannot hold them:

- **Credentials.** A credential is not a subject vertex — it is the artifact that *wields* an
  identity (§2). The same identity through two credentials is **one vertex but possibly two
  subjects** (one attenuated). "Who can reach what" is in the graph; "how the request was
  authenticated, and whether that credential is narrowed" is not.
- **Carriers / binding strength.** *Where* a fact lives and *who can change it* is invisible in
  the graph: "Alice is an admin" as a **signed claim** (unforgeable) versus a **self-set
  header** (a suggestion) is the *same arrow*, opposite security (§13). The drawing can't tell
  them apart.
- **Subject-level tiers / caps.** A global role (`ADMIN`/`VIEWER`) is a clearance **stamped on
  a subject**, applied as a bound — a baseline or a `min` — **not** a junction vertex with
  outgoing grant edges (§3, "Composition: ∪, ∩, ∖" — cap vs deny).

A test when extending the model: *if a fact says **who-can-reach-what**, it is an edge; if it
says **how-a-request-is-carried**, **where-a-fact-lives**, or **how-high-a-subject's-ceiling-
is**, it is context the evaluator applies around the graph — keep it out of the edge set.*

### A structural caution: the resource graph is often not a single tree

Containment (`childOf`) is what lets a grant on a container reach everything beneath it.
But resource graphs are frequently *not* a single tree rooted at one container. Some
resource types (e.g. datasets, prompts, experiments) may not nest under projects at all
— they hang off the organization, or nothing:

```
            org
          /  |  \
   project dataset prompt      ◀── dataset/prompt are NOT under project
     /  \
  trace  session
    |
  span
```

The consequence stated as a graph fact: a grant on a project is **not an ancestor** of a
dataset vertex, so *no path exists* — flat "membership in a project" silently misses
those resources. Any model built on container membership must answer separately: by what
edge does a subject reach the resources that live outside the container tree?

### Quick answers to the recurring confusions

A short FAQ — signposts only; full treatment in the sections cited. **Read the knobs, not
the labels.**

- **Is a role a set of *users* or of *permissions*?** → §3, "one primitive — four knobs."
- **How is a role different from a group?** → same.
- **Can a group have permissions attached directly?** → same.
- **Can a role be a bare subject set with *no* intrinsic permissions?** Yes — when capability
  is **external** (policy-layer roles). **Watch the layer:** the *same* product may *also*
  attach RBAC permissions to that role elsewhere.
- **Is *deny* the same as a *cap*?** → §3, "Composition: ∪, ∩, ∖."
- **Are credentials part of the access graph?** → §2 (identity/credential split) and §13
  (carriers).
- **What is a carrier, and why care?** → §13.

---

## 4. Two Families: Stored Edges vs Computed Edges

Re-stated through the graph, the two families differ in exactly one way: **where the
edges live.**

*A note on a related third pattern.* **Relationship-based access (ReBAC)** — tuple stores with
`check`/`expand` APIs — is a recognized family of its own: it stores edges (like Family A) but
computes transitive reachability through them as a first-class operation, often via a dedicated
authz service. It is **out of scope** for this survey — none of the profiled peers use it — but
worth knowing it exists, because a containment-heavy model (§3's "not a tree") is the point where
teams sometimes reach for it. ReBAC earns a fresh look when the graph becomes the product:
many object types, upward and downward inheritance, cross-container sharing, "who can see X?"
expansion, and consistency requirements that are hard to keep correct in hand-written SQL.
It is not automatically the right answer for a simple enumerable-grant model; it brings a
service boundary, schema language, caching, and consistency semantics. Treat the A/B split
below as the axis *within* stored-vs-computed, not the whole taxonomy.

### Family A — Enumerated grant: edges stored on disk

Membership rows, scoped-permission rows, and ACL rows **are edges**. You write them into
tables. Answering "which projects can Alice see?" is a **traversal**: start at `Alice`,
follow `memberOf → hasRole → grants → childOf`, and collect the resource vertices
reached.

```
  Alice
    │ memberOf
    ▼
 group:checkout-team
    │ hasRole
    ▼
 role:editor ──grants(read,write)──▶ project:checkout
                                          │ childOf⁻¹  (walk down containment)
                                          ▼
                                    traces, spans, sessions
```

The set of vertices reached **is** the SQL `WHERE id IN (...)`. Traversal over indexed
foreign keys is what databases are built for — expressed as joins, semi-joins, or recursive
CTEs when grant sets, inheritance, or pagination demand it; the resolver still handles group
expansion, subject unions, and attenuation, but the work is *traversal*, not rule-to-SQL
compilation.

### Family B — Attribute predicate: edges computed at query time

Here there is **no stored edge** from `Alice` to `project-42`. Instead `Alice` carries
an attribute (or her role carries a rule), `project-42` carries tags, and the edge
exists **if and only if** a function says so:

```
  Alice {team: checkout}                 project-42 {team: checkout}
         \                                   /
          \──────  no stored edge  ─────────/
                         ╎
        edge exists  IFF  predicate(Alice.attrs, project.tags) is true
                    e.g.  Alice.team == project.team
                    — evaluated at QUERY TIME, not stored
```

Why not store these edges too? Because there would be O(subjects × resources) of them
and the tags change constantly — every new resource and every retag would rewrite a
swathe of edges. So instead of *walking* stored edges, the system **manufactures them on
the fly**: it compiles the predicate into a `WHERE` clause that regenerates exactly the
resource set the rule would connect `Alice` to.

> This is the single hardest part of the whole space, and the graph view says why:
> Family A *reads* edges; Family B *synthesizes* them per query. The "query-time
> predicate compiler" exists only because there are no edges to follow — you have to
> invent them, correctly, in SQL, on the hot path.

| | Where edges live | How a check is answered | Cost |
|---|---|---|---|
| **A. Enumerated** | stored rows (membership / scope / ACL) | **traverse** them | cheaper; indexed joins / semi-joins / CTEs |
| **B. Predicate** | a *function* over tags | **evaluate** → compile to `WHERE` | a rule compiler; hot-path risk |

Both families need a resolver (inheritance, group expansion, subject unions,
attenuation, pagination); only Family B additionally needs a compiler that translates an
arbitrary policy rule into SQL.

The boundary between them is sharp: the first time a requirement *cannot* be drawn as "a
path from subject to resource over stored edges" — e.g. "can edit only annotations they
authored," "only spans where `cost > $5`" — you have crossed into Family B, and the
predicate compiler is on the table.

Each family is strong where the other is awkward: "give this person this resource" is
one row for A, a contortion for B; "everyone who can see `env=prod`" is one policy for
B, an enumeration chore for A. In the surveyed set, three products are **primarily**
Family A. The fourth ships **Family A at the workspace layer** (stored role/membership
edges) and adds a **narrow Family B refinement** on top — because the product has a
curated tagging model below the workspace, not because it replaced enumerated grants.

**In practice, Family B is far narrower than its theory.** The surveyed predicate peer
restricts rules to one kind of curated, server-managed resource tag — no resource content or
telemetry. Predicates like "only spans where `cost > $5`" are unexpressible: the
security-bearing attribute is **privileged and admin-curated by construction** (§13), never
client-supplied. Tag-at-creation closes the window where a new resource briefly carries wrong
tags. The lesson: implementations ship "predicate over one curated attribute, applied at birth,"
not the open-ended theory — because the alternative makes content part of the security surface.

The split is a lens, not a permanent commitment. A real system can start fully
enumerated and later add constrained predicate edges for a single narrow surface (say,
an attribute-scoped rule on one resource type) without converting wholesale. The
discipline a hybrid demands is that **each listing endpoint knows which family it is
resolving under** — a query that must satisfy both a stored-edge filter and a computed
predicate has to compose them deliberately, not assume one family answers everything.
Treat the taxonomy as a property of each access path, not a label stamped once on the
whole system.

---

## 5. The Effective-Access Formula and the Single Oracle

The vocabulary composes into one sentence:

```
effective access  =  authority(identity)  ∩  attenuation(credential)
```

…evaluated, for every request, by **one** function — the oracle — exposed in the three
shapes from Section 1:

```
can(subject, action, resource)            → yes/no          (the check)
accessible_ids(subject, action, type)     → query filter    (the list)
subjects_for(resource, action)            → who             (the audit)
```

Why intersection (∩) is the right glue:

- **It can only narrow.** No attenuation, credential, or header can *add* power beyond
  the identity's. Escalation bugs become structurally impossible on that side.
- **The two terms are independent.** How authority is stored (the family choice) and how
  credentials are capped can be designed and built separately, in either order; they
  meet only at the ∩.

This formula is written for the common case where a credential *wields* an identity
(Alice's session, or her API key acting as her). If instead API keys or service accounts
are modeled as **first-class identities with their own grants**, the left term is
`authority(credential_identity)` — the key's own authority, not the human's — and
attenuation drops out (there is no larger identity to attenuate from). That is a
deliberate modeling fork, the same one item 7 of the checklist raises; the oracle's
signature is unchanged either way, only the resolution of `authority(...)` differs.

**The oracle is the seam.** As long as *every* check goes through it — no hand-written
`WHERE id IN (...)` in resolvers, no `if is_admin: skip` shortcuts — the implementation
behind it can evolve from "roles only" to "memberships" to "ACLs" without touching callers.

The discipline that makes this real: **the oracle is only an oracle if it has no
peers.** Two ways to name the subject is two authorization systems, and one will be
wrong; a second code path that reads the raw request identity silently bypasses every
downgrade the oracle applies.

### A worked example

Trace one request end to end. Alice is a member of the group `checkout`, which holds the
`Viewer` role on project `P`. She makes the request with an **ingest-only API key** she
minted for a collector, and asks for the spans in `P`.

1. **Resolve the subject.** The key is a credential wielding Alice's identity, so the
   subject is *Alice, through the ingest-only key.*
2. **Compute `authority(identity)`.** Walk Alice's edges: `Alice → memberOf → checkout →
   hasRole → Viewer → grants(read) → project P → (down containment) → spans`. A read
   path to P's spans exists, so authority *includes* reading them.
3. **Compute `attenuation(credential)`.** The key carries a signed scope that permits
   ingest (write) and nothing else.
4. **Intersect.** `read(spans of P)` is in authority but **not** in the credential's
   attenuation → the intersection is empty for this action → **deny.**

The point: Alice's *identity* may read those spans, but the *credential* she used cannot —
denied by the right-hand term of the formula. Swap the ingest-only key for her browser session
and the identical request is allowed: two subjects, one identity, different answers.

---

## 6. Vendor Profiles

**Reading any product through the framework.** Before the profiles: this grid classifies *any*
RBAC/ABAC system. Force each product through the same questions and its "roles vs. groups"
labels stop mattering — you read the *knobs*, not the nouns:

1. **Subject sets** — users, groups, roles, service accounts?
2. **Membership source** — local UI, IdP/SCIM, token claim, code?
3. **Where capability lives** — attached to the set, an external grant, a policy, a code constant?
4. **Scope** — org, workspace, project, object, tag-predicate?
5. **Composition** — floor (`∪`), cap (`∩`), or deny (`∖`)?
6. **Grant form** — stored edges or computed predicates (Family A vs. B, §4)?
7. **List-query shape** — what does "which objects can X see?" compile to (§1)?
8. **Carriers & revocation** — where do facts live, how fast do changes take effect (§13, §12)?
9. **Credentials** — identities, or credentials that *wield* identities with attenuation (§2)?
10. **Audit answer** — can it say "why can / can't X see Y?" (§14)?

The profiles below answer roughly #1–#5 for each vendor; §11–§14 cover #6–#10.

### Vendor A — Membership

Access comes from a membership row — "this user is in this project with this role." The
unit of access is the project; what each role *can do* is a **constant in code**, not
data. Tenancy is a two-level Organization → Project hierarchy. The list query is a
trivial lookup of the user's membership rows. **Limit:** access stops at the project —
no scoping below a whole project.

### Vendor B — Scoped Permissions

A permission carries a **scope string** naming what it applies to (a resource container,
or a single resource). Resources are grouped into containers and a role is granted on a
container; the list query becomes `WHERE container_id IN (…)`. Finer than Vendor A
(single container or single resource), but still object-level, not attribute-level; the
granular tier is typically enterprise/paid.

### Vendor C — Per-Object ACLs (with org container)

A **hybrid of container + per-object grants**, not object-grain isolation alone. The
top level is an **organization**; ACL rows on the org cascade to every project and object
within it, **including projects created later**. Below that, for *any* object —
organization, project, single experiment — you write an ACL row: "(user *or* group) has
(**permission** *or* **role**) on (object)," with grants **inheriting downward**. Objects
are addressed through a generic typed-object reference — including first-class types for
telemetry and interactive resources, not just containers — so one mechanism covers every
type.

**Subjects are first-class** — a grant's subject may be a user or a group; group members
may be users **or service accounts** (via group membership, not a separate side-channel).
The product distinguishes built-in, org-wide permission groups from reusable role bundles
used in grants. Custom permission groups with project- or object-level scope are
enterprise-tier; built-in groups cover lower tiers, with finer built-in tiers gated by
plan.

A container grant can be **type-narrowed** without ABAC: an inherited permission can be
limited to one descendant kind (for example, org-wide read but only for prompts).
Creating an object auto-writes a **direct owner grant** for the creator (toggleable).
Permissions are **additive only** — higher-scope grants cannot be revoked at a lower
scope. The list query remains grant-rows → ids → `IN (...)` (+ inheritance and group
union).

### Vendor D — RBAC + Curated-Tag ABAC (hybrid)

The clearest **hybrid** in the survey — not a pure attribute-predicate system. Coarse
access is **Family A**: organization- and workspace-scoped **roles** carrying a large
`resource:verb` permission catalog; members hold separate org and workspace role
assignments. Fine access is **Family B, narrowly**: **access policies** attach to
workspace roles and condition a specific permission on **curated, server-managed resource
tags**. The predicate domain is deliberately narrow: no telemetry or resource content.
Tags are created by workspace admins; applying tags at resource birth is permissioned and
supported inline on create payloads.

Policies have a documented **effect** (`allow | deny`; deny wins). An allow policy can
grant even without a matching RBAC permission — so deny/non-monotonic resolution lives in
the ABAC layer even though RBAC itself is allow-only. High-volume child records inherit
their **parent project's tags**; conditions support pattern matching and
missing-attribute defaults. Within a workspace, a tag-defined application grouping
organizes resources below the container.

**Groups are not grant subjects** — identity-provider groups map to role assignments
(SCIM on enterprise tiers; lighter SSO group sync as an alternative). **Service accounts**
are first-class org-scoped machine identities (distinct from user-attenuated personal
tokens). **Capability URLs** for anonymous read of selected resources form a third access
path outside RBAC/ABAC, gated by dedicated share permissions. List queries must
**compose** stored role/membership filters with tag-policy evaluation — not a tag-compiler
alone.

---

## 7. How Groups Relate to Access

Groups attach to access in **two fundamentally different ways**, and the choice shapes
everything else.

**Pattern 1 — Group as a grant subject.** The group is a first-class entity you grant a
permission or role *on a resource* (Vendor C — the primary model there). Membership and
grants are independent: the grant says *what the team can access*, the membership says
*who is on the team*, and team churn never touches the grant rows. Naturally supports
service accounts as group members.

**Pattern 2 — Group as a role-mapping input.** The group is not a standalone subject;
identity-provider groups map to a **role assignment within a tenant**. The group is a
transient login-time input; what persists is the resolved assignment — a row, session state,
or IdP claims re-derived each session — not the membership graph (Vendor D, enterprise SSO).
SCIM-backed systems may persist membership for deprovisioning. **Data minimization:** the
descriptive group is not retained as a grant subject, only the outcome it resolves to.

These are not interchangeable. Pattern 1 gives per-object control and lets access follow
teams without enumeration; Pattern 2 keeps access tied to a tenant boundary and stores
less identity data. The choice tracks the unit-of-isolation decision in Section 9.

### Service accounts as subjects

A **service account** is a non-human identity — a first-class actor that exists
independently of any person, holds its own grants, appears in audit logs under its own
name, and authenticates with its own long-lived credential. It is the alternative to the
other way of granting a machine access: a **personal API key**, which is a *credential
wielding a human's identity* (the credential/identity fork of Section 2 and the formula
in Section 5). When a collector posts with a person's key, the server sees that person;
when it posts with a service account's key, the server sees the service account.

The case for service accounts is lifecycle and blast radius:

- **They outlive people.** A personal key dies on offboarding; a service account is not tied
  to a person, so removing a human does not take down a workload.
- **Least privilege without a human's authority.** An unattenuated personal key carries all
  of its owner's power; a service account is granted only what the workload needs.
- **Honest audit and ownership.** Grants and audit entries name the workload, not a person
  standing in for a cron job.
- **Clean rotation.** Revoking a service account's credential never entangles a person's
  interactive sessions.

The cost is the data trade Section 17 weighs: first-class service accounts make the
subject set a **union** (`user | service_account | group`) from the first schema that
has subjects, and persist more identity rows.

**Support tracks the group-handling choice.** Where groups are first-class grant
subjects (Pattern 1), a service account is just another group member or direct grantee —
it reuses the existing subject machinery with no special case, which is why the
per-object-ACL peer supports it cleanly. Where access is resolved from identity-provider
group claims at login (Pattern 2), a non-human has no login and no claims, so it does
not fit the primary path; those products provision machine access separately — typically
as a **first-class service account** scoped to the org/workspace (Vendor D). The same
design choice that decides group handling shapes how clean machine access is, not whether
it exists at all.

---

## 8. Roles and Custom Roles

| Capability | Observed across peers |
|---|---|
| Built-in roles | universal (Owner/Member/Viewer-style) |
| Roles defined as **data** (not code) | most, except the lightest membership model |
| **Custom roles** | common, frequently gated to higher/enterprise tiers |
| Role scope | varies: account/workspace-wide, or per-granted-object |

The key distinction is *scope*. A **global** role governs what kinds of action you can
take account-wide; an **object** role governs what you can do on a specific resource a
grant names. ACL-family products tend to support permission sets;
workspace-membership products tend to use global ones.

One subtlety from the graph view: a role (and a group) is a junction many paths run
through, which is why **editing or deleting one is high-blast-radius** — redefining
"Viewer" changes everyone's access at once (§14: the audit unit must be *effective-access
change*, not *row written*).

---

## 9. Tenancy and Isolation

The single largest architectural fork is **the unit of isolation**. In graph terms,
multi-tenancy wants the graph to split into **one connected component per tenant, with
no edge crossing the boundary**:

```
     ── org A ──                 ── org B ──
     Alice → projA               Bob → projB
              │                         │
            spans                     spans

     isolation proof = "no path crosses the gap"
```

Three implementations, three graph statements:

- **A tenant-id column** — one graph; every query *filters* edges to the current
  component. Isolation depends on never forgetting the filter.
- **Row-level security** — the same single graph, but the database *enforces* the
  `component = current_tenant` filter automatically; you cannot forget it.
- **Schema/namespace per tenant** — literally separate graphs; cross-component edges are
  impossible by construction.

The fork at the product level:

- **Object-grain (grant per resource).** Isolate by authoring grants on individual
  resources. The pure form has no hard tenant boundary — names can collide across teams.
  **Vendor C is not the pure form:** it has an **organization container** whose grants
  cascade org-wide (including future projects), then per-object ACLs below. Container +
  per-object grants, not tenantless object-grain alone.
- **Workspace-grain (membership per tenant).** A workspace/org is the boundary; isolate
  by placing subjects in it with a role (Vendor D's RBAC layer, and most enterprise SSO
  models). True name isolation and per-team admins, at the cost of a heavier tenancy
  layer. Vendor D then adds tag-conditioned refinement *within* the workspace — the
  hybrid of Section 4.

A related invariant worth stating up front: **an unauthorized read should look exactly
like the resource not existing.** A response that distinguishes "you may not see this"
from "this does not exist" leaks names and existence across the boundary. This is a
property of the oracle's consumers, decided early.

A classic tenancy pitfall is **globally-unique identifiers**: if record ids
(trace/span/session ids) are global, two tenants ingesting the same id force one vertex
into two components — a cross-tenant merge. The fix is to make identity component-local
— `(tenant_id, record_id)` as the key — so identical ids from two tenants are simply
different vertices.

---

## 10. Identity Provisioning

- **SSO (SAML/OIDC)** is universal for authentication and, where supported, for carrying
  group/attribute claims *at login*. Claim-based mapping is evaluated only when a user
  authenticates, so membership changes lag until the next login and offboarding does not
  retire credentials that bypass interactive login (e.g. API keys).
- **SCIM provisioning** appears among more enterprise-oriented products — a push-based
  continuous sync of users and groups from the provider that closes the staleness window
  and, critically, handles **deprovisioning** in near-real time. Where SCIM is absent,
  group handling is login-time only.
- **Group-to-role mapping** is **per-identity-provider** and usually locked by email
  domain; identically-named groups from different providers are treated as distinct.

---

## 11. Expressing Exceptions: How Systems Say "No"

In an allow-only system, adding a rule can only ever *add* access. That property —
**monotonicity** — buys three things: the oracle can stop at the first matching grant;
independent sources of authority compose safely (a new source never breaks existing
access); and every "yes" has a **witness** (a row to point at when asked "why can Alice
see this?").

When a requirement sounds like "no," walk up this ladder and stop at the first rung that
works:

1. **Absence** (default-deny) — just don't grant it. Solves most cases. In graph terms
   this is *no path found* — nothing is stored, it fails closed, and every system
   already has it.
2. **Structure** — make the wall an *absence of reach*: put the sensitive thing in a
   container the broad grant does not extend into. Solves "the org sees everything
   *except the PII project*" with no deny rule — provided container structure matches
   security boundaries.
3. **Attenuation** — cap the *credential*, not the world ("this collector key can only
   ingest"). Subtraction, but contained to one credential.
4. **Explicit deny** — a global override rule, a *negative edge*. The residue that
   genuinely needs it is real but small ("contractors never touch prod, no matter what
   roles they accumulate").

**Explicit deny is expensive because it destroys all three nice properties:**

- **No short-circuit.** Finding an allow-path is not enough; you must prove the
  *absence* of any blocking edge, every time.
- **Composition becomes dangerous.** A check that walks two grant sources but forgets a
  third *deny* source is no longer a lost-access bug — it is a security hole. (This is
  the real reason "ship the simple model now, layer attributes later" is only safe while
  you stay allow-only.)
- **The veto can sit off the path you walked.** A tag-predicate deny attaches to a
  resource *by attribute*, not along containment, so "why *can't* Alice see this?" loses
  its single witness, and "grant = access" breaks — you can see the grant row and she
  still cannot reach the resource.

There is also a trap specific to predicate deny: the negative edge exists only while the
tag exists, and the tag is usually editable by the resource's own team:

```
  before:   Alice ──allow(org-wide)──▶ span {pii}   negative edge active → blocked
  after the pii tag is removed:
            Alice ──allow(org-wide)──▶ span {}       negative edge GONE → path live
            …no grant, role, or policy changed. The data fell open silently.
```

**Deleting a tag became a grant** — performed by exactly the people the deny was meant
to constrain. The reformulation that makes most denies disappear: instead of *adding a
negative edge*, **narrow the positive edge so absence fails closed**:

```
  deny-form:   allow(org-wide)  +  deny if pii     → tag-delete LEAKS
  allow-form:  allow iff tag == public             → tag-delete FAILS CLOSED
```

If explicit deny ever ships, decide its semantics *early* (retrofitting it invalidates
every consumer that learned "grant = access") and match it on **immutable** properties
(subject identity, ancestry), never a mutable tag.

---

## 12. Behavior Under Change

A static schema diagram hides most traps; they appear only when something changes. Four
changes every design should be simulated against:

- **A resource is created.** Broad grants include it automatically (maybe wrongly);
  enumerated grants exclude it silently (maybe wrongly). Neither is safe — the question
  is *which mistake happens silently.* "What does a new resource's visibility default
  to?" is the security posture stated in the future tense, per resource type.
- **A person leaves.** Does their access actually end (and how fast — the *revocation
  budget*)? Do their API keys die with them (breaking pipelines) or linger as ghosts?
  The clean answer is to stop conflating credential with identity — give machine
  credentials their own identity or attenuation so human offboarding is not entangled
  with service continuity.
- **A group or role definition is edited.** Adding someone to a group, or redefining a
  role, changes access broadly and instantly — a grants-table audit log keyed on row writes
  shows nothing (§14).
- **The grants table itself is written.** Granting is an action on a resource too. A
  viewer who can open a sharing dialog and make themselves an editor was never a viewer.
  The rule: *you may grant at most what you hold*, checked through the same oracle as
  everything else.

---

## 13. Matching Facts to Carriers

Every authorization fact lives on a carrier, and a large share of real flaws are a heavy
fact on a weak carrier. Ordered weakest to strongest for **legitimate mutability and
revocation latency** — who can change the fact, and how fast changes take effect:

- **Self-reported header** — the holder can shed it by omission. Legitimate only as a
  *guardrail* for a cooperating party (observability, agent self-labeling), never as a
  boundary against an adversary.
- **Tag** — editable by whoever edits the resource; dangerous the moment it *gates access*
  (§11). Security weight requires a privileged key or an immutable property.
- **Cache / flattened claim** — holds a stale copy until it expires. Real revocation
  latency is *the longest cache TTL in the chain*; pick a revocation budget and let it
  constrain caching, not the reverse.
- **Signed token claim** — cannot be altered by the holder; narrows-only when used for
  attenuation. A strong carrier for capability scoping.
- **Database row** — the source of truth; changes take effect as fast as the caches in
  front of it allow.
- **Code constant** — only engineers and code review can change it; deploys are audited.
  A *strong* carrier, appropriate for facts that change at the pace of releases (what a
  built-in role can do) and wrong for facts that change at the pace of customers.

This is not a single tamper-resistance ladder under every threat model. A code constant
resists casual product-admin change but a bad deploy can widen it; a database row changes
legitimately with ease but is also what a database compromise rewrites. Use this ordering for
access-model placement, and name a different ordering if the threat is breach resistance.

One carrier becomes an **access path** of its own: the **capability URL** — an unguessable
share token where *possession of the link is the access.* It sits outside all four families
(no subject, no grant row, no predicate). At least one surveyed peer offers it, gated by a
`share` permission. Useful for frictionless external sharing; dangerous because a leaked link
is a **silent grant** no "who can see X?" review surfaces, persisting until the token is
rotated. If offered: minting is a privileged action; tokens should be first-class **revocable**
objects; remember they are a second door the oracle never sees.

---

## 14. Auditing: the Record vs the Decision

Access control decides; auditing *records*. They are adjacent and easy to conflate, but a
system needs both, and the record has its own design questions the decision model does not
answer. Three distinct things travel under the word "audit":

1. **The audit query — "who can see X?"** This is the read side (Section 5's
   `subjects_for`): given a resource, enumerate the subjects who currently reach it. It is
   a *present-tense* question about the access graph, not a log. It is the shape forgotten
   until a sharing dialog or a compliance review needs it (Section 1).

2. **The change log — "how did access become what it is?"** A record of grants written,
   roles edited, group memberships changed. The sharp pitfall (Sections 8 and 12): a log
   keyed on *grant rows written* misses the highest-blast-radius changes, because
   redefining a role or editing a group alters everyone's access at once while writing zero
   grant rows. **The audit unit must be the *effective-access change*, not the row
   written** — which means the log has to record the resolved consequence ("these subjects
   gained read on these resources"), not just the literal mutation.

3. **The action log — "who did what?"** A record of the actions subjects took: reads of
   sensitive resources, writes, deletes, cross-boundary moves, logins, credential minting
   and use. This is what most people mean by "audit log," and the access-control model
   barely touches it — yet it is where compliance lives. Note especially **read auditing**
   ("who *accessed* this private resource"), which is different from the audit query ("who
   *can*") and is often the actual regulatory requirement.

**The single oracle is the natural emission point.** The same seam that *decides* access
(§5) should *emit* audit records: every check flows through it, so decision and log entry
are produced together. Audit bolted on at scattered call sites logs inconsistently for the
requests that matter. Returning (or emitting) the *reason*, not just the boolean, makes deny
explainable ("why can't I see this?", §17) and lets the change log state consequences, not
mutations.

What to record is the conventional tuple — **who** (subject *and* credential, §2), **what**
action, **on what** resource, **when**, **from where**, and **result** (allow/deny, and on
deny, why). The log must be **append-only and tamper-evident** (§13 binding strength) with
**retention** as a policy input — what makes access control *accountable*, not part of the
decision itself.

---

## 15. Comparison Matrix

| Dimension | Vendor A | Vendor B | Vendor C | Vendor D |
|---|---|---|---|---|
| Family | membership | scoped permissions | per-object ACL + org container | **RBAC + curated-tag ABAC (hybrid)** |
| Edges | stored | stored | stored | **stored (RBAC) + computed (ABAC)** |
| Sub-object / attribute-level scoping? | no | no | type-narrowed inheritance | **yes (ABAC tags)** |
| Roles as data | no (code) | yes | yes | yes |
| Custom roles | no | partial | custom groups (enterprise) | yes (enterprise) |
| Group as **grant subject** | no | no | **yes** | no |
| Group as **role-mapping input** | n/a | yes | SSO only; primary = grant subject | **yes (SCIM / SSO sync)** |
| Service accounts as subjects | limited | limited | **yes (via groups)** | first-class org-scoped |
| Allow / deny | allow-only | allow-only | allow-only | RBAC allow-only; **ABAC allow + deny** |
| Isolation unit | project | container | **org → project → object** | **org → workspace** (+ tag groups) |
| List-query mechanism | membership `IN` | scope `IN` | ACL `IN` (+ inheritance) | **role filter + tag-policy compose** |
| SCIM provisioning | unknown / not observed | unknown / not observed | SSO (no SCIM observed) | yes (enterprise) |

---

## 16. Cross-Cutting Findings

1. **Enumerated-grant is the common baseline in this surveyed set.** All four store
   coarse access as rows resolved to `id IN (...)`. One peer adds a **narrow
   attribute-predicate refinement** on top of stored RBAC — curated tag keys only, not a
   wholesale Family B conversion — and is the only one composing a query-time tag-policy
   evaluator alongside stored edges.
2. **Allow-only is the norm at the coarse layer.** Three of the four are allow-only
   throughout; the hybrid peer is allow-only in RBAC but supports **explicit deny in
   ABAC** (deny wins). The enumerated families handle exceptions structurally (don't
   grant) rather than with deny.
3. **Groups attach two ways** — as grant subjects, or as role-mapping inputs — and this
   is the clearest design signal. Subject-based group access pairs with per-object ACL
   models (Vendor C); role-mapping pairs with workspace-grain isolation (Vendor D).
   Vendor C also has SSO but its primary model is Pattern 1, not IdP group resolution.
4. **In this set, three of four model roles as data, with custom roles usually tier-gated.**
   Of those three, two support fully custom roles and one a partial set — frequently behind
   an enterprise tier.
5. **The unit of isolation (object vs workspace) is the dominant fork** and drives group
   handling, role scope, and name collisions. Even object-grain ACL products may still
   ship an org container (Vendor C); the fork is whether workspace membership is the
   *primary* isolation story (Vendor D) or per-object grants with org-wide cascade (Vendor C).
6. **Provisioning maturity varies.** Login-time SSO mapping is common; continuous SCIM
   provisioning (and prompt deprovisioning) is an enterprise differentiator (observed on
   Vendor D; Vendor C documents SSO but not SCIM).

---

## 17. Implications for Design

The landscape suggests a default path and a few decisions to make deliberately rather
than inherit (detail in §18):

- **One scope assumption to check first: who *creates* the resource.** This survey (and the
  `ownerOf` edge in §3) assumes the familiar UI-driven story — a user creates a resource and
  becomes its owner. Products whose resources are **machine-created** (pipeline / ingest-born,
  no human creator) break that assumption and need a separate **birth-time policy**: default
  visibility when there is no owner, and a split between **write (ingest) authority** and
  **read (visibility) authority** that the owner-grant pattern doesn't address. If that's your
  world, the owner-grant default below may not apply — see the companion Phoenix design notes,
  which treat machine-created, ownerless resources as the central problem.

- **Let the shape of the requirement pick the family.** Pick enumerated grants unless a real
  requirement is shaped "everything matching X" — and Family B brings a tag-as-security-surface
  problem (§18 #1).

- **Allow-only is a safe default.** The *semantics* of deny are not cheap — precedence, audit,
  list-query shape, authoring UX — and either way, do not write a single `deny` row until those
  semantics are designed (§18 #10).

- **Decide the unit of isolation consciously** — object-grain vs workspace-grain is the dominant
  fork (§18 #2).

- **Choose group handling with eyes open** — first-class grant subjects vs role-mapping inputs
  follows from that fork (§18 #8).

- **Treat provisioning as a maturity axis, not a correctness one** — login-time SSO mapping ships;
  SCIM is the enterprise upgrade (§18 #12).

---

## 18. A Decision Checklist

A team designing access control can settle the questions below in order; each answer
constrains the next, and most cannot be changed cheaply once data exists — schema for
subject unions, default visibility, and revocation posture costs nothing now and a rewrite
later. The list is deliberately product-agnostic — substitute your own resource and container
names where appropriate.

1. **Family.** Is access "these subjects, these named resources" (enumerated edges you
   store and walk) or "everything matching this predicate" (edges you compute from
   attributes)? Pick the enumerated family unless a real, named requirement is shaped
   "everything matching X." The choice decides whether you owe a rule compiler.

2. **Unit of isolation.** Is the boundary the individual object, or a container /
   workspace? This is the dominant fork: it drives group handling, role scope, name
   collisions, and whether a tenancy layer is required up front.

3. **Resource reachability.** When a subject can reach a container, what can they reach
   *through* it? Define the containment edges and whether access flows down them, so
   "access to a project" has one unambiguous meaning for its children.

4. **New-resource default visibility, per type.** When a resource is created (often
   implicitly, by first use), who can see it — everyone, the creator, or a container's
   members? Decide this per resource type; the answer is a security posture, not a
   default you can flip later without surprising users.

5. **Revocation budget.** When a grant is removed, how promptly must access stop —
   immediately, or by next login/token refresh? This determines whether you can cache
   resolved access and for how long.

6. **Unauthorized read ≡ not-found.** Does probing a resource you cannot access return
   "forbidden" or "does not exist"? Returning not-found avoids leaking the existence of
   private resources, but must be applied uniformly across point lookups and lists.

7. **Subjects.** What kinds of subject can hold a grant — users, service accounts,
   groups? Put the union type in the first schema that has subjects, even if only users
   are populated initially. Decide explicitly whether API keys are *credentials* that
   wield a subject's identity (and attenuate it) or *identities* that hold grants of
   their own.

8. **Group handling.** Are groups first-class **grant subjects** (a group can be granted
   a specific resource) or **role-mapping inputs** (a group resolves to a role at
   login)? The first persists a membership graph and pairs with per-object ACL models
   (often with an org container above — Section 9); the second stores only the resolved
   assignment and pairs with workspace-grain isolation. This follows from the
   unit-of-isolation choice.

9. **Roles.** Are roles code or data? Will you offer custom roles, and at what scope —
   global, or scoped to a single object? Roles are an edge-count compression over
   (subject × permission); decide early whether that table is yours to extend or fixed
   in code.

10. **Deny in scope.** Do you need explicit deny, or does allow-only with specificity
    precedence suffice? If deny is plausible, reserve the schema field (`effect`) now to
    avoid a later migration — but do not implement deny *semantics* (precedence, audit,
    `NOT IN` query shape, authoring UX) until a concrete requirement forces it. If deny
    is genuinely out of scope, omit the field rather than ship a column that invites
    callers, tests, and future engineers to assume deny already works.

11. **List-query shape.** Every listing endpoint must filter by the same access rule the
    point check uses. Confirm the oracle can produce a **relational predicate the
    database applies before pagination** — indexed joins, semi-joins, or a CTE resolving
    to `id IN (...)` — rather than a per-row check evaluated in application code after
    the rows are fetched. Verify this before the object count grows.

12. **Provisioning.** Is login-time SSO mapping enough to ship, or is continuous SCIM
    provisioning (and the prompt deprovisioning it enables) a named requirement? Treat
    this as a maturity axis to grow into, not a correctness gate.

13. **Oracle location.** Is the resolver **in-process** (a library call) or **delegated** to an
    external policy engine / authz service (a network hop, e.g. OPA / Cedar / a ReBAC store)?
    This decides latency, caching, consistency, and who owns the decision — and it is hard to
    reverse once call sites assume one or the other.

14. **Rollout / migration.** If you are turning this on for an **existing** deployment, is the
    cutover a graceful no-op or a **hard open → fail-closed flip** that hides previously-visible
    data until grants are written? Plan the blast radius (a dry-run "who loses access?" preview)
    *before* flipping; a fail-closed cutover is a planned outage, not a config toggle.

15. **Surface coverage & oracle bypass.** Does **every** read/write surface — list, point-get,
    count, aggregate, export, subscription/stream, and *every* API (REST *and* GraphQL) — route
    the **same predicate through the same oracle**? The same operation on two surfaces must give
    the same answer, or the stricter one is bypassable by switching surfaces. One forgotten
    endpoint is a silent leak no model-level test catches.

A single rule resolves all of these consistently only if every check — point lookups and
list queries alike — routes through one oracle. Two code paths that each answer "can
this subject do this?" is two authorization systems, and one of them will eventually be
wrong.

> If you keep one line: **enumerated access is edges you store and walk; predicate
> access is edges you compute on the fly. Both still need a resolver that turns a
> request into an `id IN (...)` filter; only the predicate family additionally needs a
> compiler that turns a policy into that filter.**
