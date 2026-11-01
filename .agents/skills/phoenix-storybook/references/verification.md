# Verifying stories in a browser

`pnpm lint:storybook` checks structure; it cannot see layout, theming, or
overflow. Use the repo's Playwright against the running dev Storybook (its
port is `STORYBOOK_PORT` in `js/app/.env`, default 6007) for the checks
below. Computed styles and bounding boxes in a screenshot-free probe are
enough, and catch problems a screenshot hides.

Load a story or Docs page in `Both` mode with the `globals=theme:both` URL
query, at a 1280px viewport.

## No horizontal scroll

Assert that no element with `overflow-x: auto` or `scroll` has
`scrollWidth > clientWidth`, on every story you authored or changed and on
its Docs page.

Confirm the probe can fail. A URL `parameters=` override does not change
story parameters, so a negative control has to change the file (for example,
temporarily switch a wide grid to `themeLayout: "row"`).

## Launched layers take their panel's theme

Held-open layers show their theme at a glance; launched ones do not until
pressed. Press the trigger inside each `.theme--light` and `.theme--dark`
`[data-testid=story-surface]`, and assert that the opened layer's
`closest(".theme")` carries that panel's theme class.

## Open layers do not overlap

For a stack of held-open layers, compare bounding boxes: no layer may cover
another layer or its neighbor's trigger.

## Long content actually overflows

For a content-length story, measure that the long case's natural width
exceeds its container in the wrapping mode (see
[content-length](content-length.md)).

## Sidebar chips

After a `manager.ts` change (restart the Storybook server first), load a
story tagged `unused`, assert `.phoenix-chip` exists, read `getComputedStyle().color`
in both manager themes, and check that the chip row's top edge is below the
name's bottom edge.

## Tags and autodocs in the index

To check which tags a story really has, run `storybook build` and read the
generated `index.json`. Remove the build output afterward.
