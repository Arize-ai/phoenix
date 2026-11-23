# Themes and framing

Storybook's `Both` mode renders the light and dark themes simultaneously.
Every story must stay legible in it.

## Contents

- Choose `themeLayout` deliberately
- Nothing scrolls horizontally
- Split by orientation when orientation sets the shape
- The frame themes every layer
- Frame for the production context

## Choose `themeLayout` deliberately

- `themeLayout: "row"` puts the themes side by side, each with half the
  canvas. Use it for compact or naturally narrow content (a vertical stack of
  color steps, a narrow vertical group).
- `themeLayout: "column"` stacks the themes, each with the full width. Use it
  for wide, tall, or comparison-heavy content.
- Any `OptionGrid` with more than one cell column, or any story wider than
  about half the canvas, takes `"column"`.

## Nothing scrolls horizontally

The row layout gives each theme half the canvas, so a grid that fits one
theme overflows at half width: a 783px states × sizes grid scrolls inside a
640px panel at a 1280px viewport. Check every story you author or change, and
its Docs page, rather than trusting the estimate — the probe is in
[verification](verification.md).

## Split by orientation when orientation sets the shape

Wide, short content (a horizontal radio group) stacks its variants as rows and
takes `"column"`. Narrow, tall content (a vertical group) takes `"row"`, and
its grid must fit half the Docs page's width. Do not put both orientations in
one story, which forces one theme layout onto both shapes. When the narrow
story still overflows at half width, move variants that do not depend on
orientation (required, disabled) into the wide story rather than wrapping
labels or overriding the grid.

## The frame themes every layer

A layer's theme comes from its nearest `.theme--<name>` ancestor, and a
portaled layer has none of the story's: on `document.body` it falls back to
`:root`, which every theme panel's `GlobalStyles` writes, so each panel's
popovers took whichever theme mounted last.

`ThemedStory` in `js/app/.storybook/preview.tsx` fixes this at the one level
that owns theme scope: each panel gives React Aria an `UNSAFE_PortalProvider`
whose container is a themed host (`data-testid="story-portal-host"`) on
`document.body`, where the portal would have gone anyway, so placement is
unchanged. Nested hosts still win where they are needed for placement
(`HeldOpenCell`, the thumbnail frame).

This rules out per-story fixes: no `UNSAFE_PortalProvider`, theme class or
`ThemeProvider` wrapper in a story to theme its layers, and no `themeLayout`
or single-theme workaround for a layer that shows the wrong theme. A layer
that still escapes its panel is either not a React Aria portal (DOM appended
by hand, a `Toast` outside its `ToastRegion`) or a gap in the frame: fix the
frame, or leave the component out of the story.

Launched layers (a `+N` badge popover, a menu's `Interaction` story, a hover
tooltip) do not show their theme until pressed, so launch each from both
panels before calling a `Both` story done ([verification](verification.md)).

## Frame for the production context

- Size and frame each story according to the component's production context:
  its real row, menu, toolbar, form, panel, or dialog container, and only the
  context that materially affects it.
- Check the combined result for clipping, crowding, excess empty space, and
  misleading responsive behavior. Adjust the story frame rather than changing
  the production component to improve the Storybook composition.
- **Show each regime once, at a size that fits the Docs page.** A case that
  only stretches a component to the viewport (`100vw`, `100vh`) adds nothing
  when a bounded case reaches the same behavior: a fade clamp
  `clamp(48px, 15%, 128px)` has three regimes, and three bounded widths show
  them. Delete such a story rather than hiding it from both the sidebar and
  the Docs page; a story no human can reach goes unreviewed.
