# Domain stories

Stories under `Domains/<Surface>/…`: components tied to one product surface
(tracing, experiments, PXI, …). These usually need fixtures, mocked data
boundaries, and many states. Placement rules for what counts as a domain
story are in [taxonomy](taxonomy.md).

## Contents

- Production truth with data
- Never a specification for unshipped work
- Match production, including its one-offs
- Collapsing many-state components
- Isolating cases

## Production truth with data

- Keep fixtures deterministic and representative of real production
  concepts. Use unusual sizes or volumes only to exercise valid behavior.
- Mock only the narrow external boundary needed to place the production
  component in a real state (a Relay environment such as
  `stories/utils/aiQueryRelayEnvironment.tsx`, a network response). Do not
  duplicate production transforms, validation, permissions, interactions, or
  derived state in the story.
- If a desired example requires fictional UI or behavior, do not add the
  story: first establish it in production, or choose a scenario production
  already supports.
- Shared fixtures live in `stories/constants/`, helpers in `stories/utils/`.

## Never a specification for unshipped work

A story whose docblock says it shows the *proposed* shape of something, or
that "doubles as the drop-in spec", is a design document in the wrong place:
it makes a false claim about production and rots once the real work lands.
A proposal belongs in an issue or design doc.

Once a component ships, the story renders it rather than re-specifying it. A
story that hand-assembles the config the production call site passes is a
second source of truth that drifts silently. Import the shipped component —
including page-level ones — and show what a reader would actually see.

## Match production, including its one-offs

When stories cover several instances of a pattern and one instance is
genuinely different in production (the top-level evaluators empty state),
leave it different. Uniformity production does not have is a fiction, and it
hides the variation a reader came to check.

## Collapsing many-state components

The general collapsing rules are in [option-grids](option-grids.md). For
domain components:

- **Group a many-state component by its own sections.** When a component
  renders several kinds of thing, one stack per kind — each showing that
  kind's states — beats one story per kind × state. `Tool Part` stacks per
  tool family (Bash, Ask User, Docs, Load Skill, Call Subagent, Execute
  Browser Action, …); `Generative UI` stacks per chart type.
- **A content or data-state set is one `Content types` story** (no prompts,
  available but unselected, loaded with latest, version or tag).
- **Exhaustive is correct when each story is a distinct thing a reader looks
  up.** `Span Info` has one story per span kind and shape because a reader
  arrives looking for one of them. Collapse only when stories vary along a
  dimension a reader compares across, not when each is a separate
  destination.
- **Collapsing is a production re-check.** Every case in a new stack must
  still match production. Seven `Tool Part` browser-action states had gone
  stale (per-call approvals that production had replaced with one
  whole-script approval) unnoticed while they sat in separate stories. Relabel
  or report stale cases; do not silently carry them.

## Isolating cases

- **Give each case in a stack its own state.** Cases that share a file-level
  store leak into each other — an approval staged for one row appearing in
  another. Give each labeled case its own provider or store.
- A story that needs its own router, data environment, or store per instance
  may stay visible in the sidebar rather than `!dev` (see
  [entry-shape](entry-shape.md)).
