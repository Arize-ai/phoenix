# Entry shape

What a component's sidebar entry and Docs page look like: which stories are
visible, which story comes first, and when an `Example Usage` story belongs.

## Contents

- One entry per piece of content
- Prefer the Docs page as the only entry
- Open on a compact example
- The Docs page itself
- `Example Usage` is the exception

## One entry per piece of content

Every sidebar entry must show something no other entry shows. Autodocs gives
each story file a Docs page that renders all its stories. With two or more
stories that overlap is useful: the Docs page is the one-scroll overview and
each story is an isolated canvas. With one story it is duplication.

So a file with exactly one sidebar story tags that story `!dev`; the Docs
page becomes the only entry and Storybook draws it as a single leaf.
`pnpm lint:storybook` enforces this. A file that gains a second story drops the
`!dev` again.

## Prefer the Docs page as the only entry

When a component's stories are all small enough to read together, tag every
one `!dev`: the sidebar lists only the Docs page, which renders every story in
order (a `!dev` story still appears there and stays reachable by URL). This is
the default for every file you author or rewrite — before finishing, check
each sidebar-visible story and tag it `!dev` unless one of these applies:

- it needs the full canvas — a page-level or `fullscreen` layout, or layered
  content too large to sit inline;
- it launches something only one of which can exist at a time — a modal, a
  single global overlay or provider — so several on one Docs page would fight
  (a toast region is not one: `ToastStage` gives each its own queue);
- giving each instance its own container is clunky (a separate router, data
  environment or store per story);
- its point is visible only in the story view — presses logged to the Actions
  panel, or a `play` function whose steps are the demonstration;
- it moves focus or affects the page on mount. Every story on a Docs page
  mounts at once, so one that opens and focuses an overlay steals focus from
  the page and the sidebar search.

## Open on a compact example

The first story is the one the Docs page shows at the top. Make it a small,
typical instance — usually `Default` — that lets a reader confirm this is the
component they came for, then put the option grids after it. A first story
that is already compact counts: `Icon Button` opens on `Sizes`, three small
buttons, and needs no separate `Default`.

An entry built around components always shown together opens with the shipped
page that composes them, before the per-component stories.

## The Docs page itself

`DocsPage` in `js/app/.storybook/preview.tsx` customizes Storybook's default:

- The Stories list excludes the primary story, because the default draws the
  first story twice. Do not restore the default.
- A file whose stories are peers with no representative instance sets
  `parameters.phoenixDocs.showPrimary: false`: the page skips the primary
  canvas and lists every story with its name as a heading.
- The props table is omitted when the file sets
  `parameters.controls.disable`, so a file whose args are fixtures rather than
  reader choices shows none.

Do not count on the props table otherwise. It comes from
`react-docgen-typescript`; a dev server configured without docgen (for
startup speed) shows only args a story declares by hand.

`autodocs` is set globally in `preview.tsx`; never add it to a story file.

Thumbnails: a component opts in by exporting one story named `Thumbnail`,
tagged `["!dev", "!autodocs"]`. See `js/app/stories/_meta/thumbnail.ts` for
the frame contract and [merging-and-removal](merging-and-removal.md) for
regeneration.

## `Example Usage` is the exception

By default an entry has no `Example Usage` story: the `Default` shows a
typical instance and the grids show every state, so re-rendering a handful of
states with production labels shows nothing new. Add one only when both hold:

- the component has extremely general usage that takes many different shapes
  across Phoenix, not one shape with different labels; and
- those shapes follow different norms and invite different failure modes, so
  seeing each in its setting teaches something the grid cannot.

A field used in many forms does not qualify: every call site is the same
shape. Neither do call sites that differ only in options the grids already
show (size, label placement, disabled, a `Text` or `Label` child). If neither
condition is clearly met, leave it out; do not add one to round out an entry
or because a sibling has one.

When an entry qualifies:

- **Draw each example from something Phoenix actually does.** Find the call
  sites and use their labels and value shapes: `Copy Field` shows Hostname and
  Platform Version (Settings › General), a Project ID, the MCP Server URL and
  an install command, with values like `http://localhost:6006`, `20.16.0`,
  `UHJvamVjdDox` and `pip install arize-phoenix`.
- **Do not hypothesize generic application use cases** — email addresses,
  shipping forms, promo codes teach nothing about where the component belongs
  here.
- **One example per shape,** with the variant, width and description
  production would choose there; every variant is the grid's job.
- **Keep the component's own label a plausible production label**; never
  write the state into it.
- **Name it `Example Usage`,** never `Gallery`.
