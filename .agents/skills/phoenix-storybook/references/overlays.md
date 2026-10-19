# Overlays and layered content

Stories for tooltips, popovers, menus, submenus, dialogs, and anything else
that opens as a layer. Toasts have their own reference, [toasts](toasts.md).
Theming of portaled layers is in [themes](themes.md).

## Contents

- Show the opened content, held open
- Helpers for holding layers open
- Menus
- Tooltips
- Launch behavior
- Layout of open layers

## Show the opened content, held open

The primary story for a layered component is about the opened content, not
how the layer is launched. Render it already open and keep it open: its
trigger, outside presses, Escape, and content actions must not close it.

- **This covers every content story of a layer, not only the first.** A menu
  whose `Item Content`, `Selection Modes` or `Content Length` stories each sit
  behind a trigger makes the reader open every case one at a time, and shows
  one theme only, since one menu can be open. Hold every case open at once so
  cases and both themes compare side by side.
- **Reach the open state through the production component's supported
  controlled state.** Do not recreate the layer or add story-only rendering.
- **Do not attach a layer to a trigger its story does not need.** A story
  about a menu's items, list or composition shows the surface and its
  content; a trigger beside each case is noise. Keep a real trigger only where
  the trigger is the point (`Menu Container`'s `Placement`) and in the one
  `Interaction` story. A part production also renders without the surface (a
  `Menu` embedded in a panel, a `GridList`) may render bare in its grids.
- When the trigger adds useful production context, show an inert instance
  alongside the opened layer, not wired to open, toggle, or dismiss it.
- **Held-open layers are pinned:** open from the first render, never
  unmounted, re-opened or animated as the reader scrolls. Layers that pop in
  and out on scroll are a defect.

## Helpers for holding layers open

All in `js/app/stories/utils/`.

- **`HeldOpenCell`** — use for a popover-based layer when a story shows
  several at once or sits on a Docs page, and pass the `boundaryElement` it
  hands you to the layer's popover. React Aria positions a popover once, when
  it opens, against the viewport, and never repositions a controlled-open
  popover as the page scrolls or grows; a layer mounted below the fold, or
  before stories above it rendered, flips above its trigger or loses height.
  The cell portals the layer into itself, measures it against a boundary
  larger than any page so it opens at its own placement, and turns off the
  opening animation. Size each cell to the room its open layer takes.
  Two approaches that do not work: opening or remounting when the cell scrolls
  into view (that is the popping), and passing the cell or story root as
  `boundaryElement` (React Aria mixes document and container coordinates for
  a custom boundary, shifting the layer sideways).
- **`HeldOpenMenu`** — anchors a `MenuContainer` to an empty point through its
  `triggerRef`; given its own `isOpen`, a React Aria `Popover` uses local state
  rather than a trigger's. `HeldOpenTriggeredMenu` keeps a real trigger.
- **`HeldOpenSubmenus` and `HoldSubmenuOpen`** — `SubmenuTrigger` has no open
  prop. It reads open state from the root menu's trigger state, keyed by a
  generated collection key that is neither the item's `id` nor a React `key`,
  so holding `"label"` open silently does nothing. `HoldSubmenuOpen itemId`
  reads the key from the item's parent node in `MenuStateContext`.

## Menus

- A held-open menu passes `autoFocus={false}` to its `Menu` (every menu on the
  page mounts at once and each would take focus) and
  `closeOnInteractOutside={false}` to its `MenuContainer` (the default consumes
  every outside press, swallowing presses meant for the rest of the Docs
  page). Pair `isOpen` with an `onOpenChange` that ignores closing.
- Give each item an `id` when a state needs a selection: React Aria reads an
  item's `id`, not React's `key`, so items keyed only with `key` can never be
  pre-selected.
- Seed a selection with `defaultSelectedKeys` (or `defaultSelectedKey`,
  `defaultValue`), not `selectedKeys`. A controlled prop with no change
  handler ignores every press and looks broken.
- The menu family's entry layout (`Menu`, `Menu Item`, `Menu Container`, …) is
  in [taxonomy](taxonomy.md).

## Tooltips

- Hold a tooltip open through its trigger (`TooltipTrigger isOpen`), never
  through the `Tooltip` itself: a tooltip given its own `isOpen` renders but is
  never positioned and lands in the page corner.
- A component that builds its trigger internally and exposes no open state
  (`ContextualHelp`, `DocumentationHelp`) cannot be held open. Give it a
  hover-driven story, a `thumbnail.hover` Thumbnail, and a description saying
  why.
- Do not put a `Button` in a `RichTooltip`'s actions: it picks up the
  trigger's focus props and ref, and the tooltip positions against its own
  button. Production uses a link there, and so should stories.

## Launch behavior

- Give the entry exactly one `Interaction` story that opens, opens a submenu
  where relevant, and dismisses normally. It is the only place launch
  behavior is shown, and the only departure from held-open presentation
  unless launch, hover, click, keyboard, focus, dismissal, or transition
  behavior is specifically requested.
- **Show a launch once.** Drop variants that repeat the launch with another
  trigger size; the size does not interact with it.
- **Give a layer's content its own sibling entry.** Variation in what a
  tooltip or popover *contains* (basic, detailed, loading, prompt only) is a
  sibling entry about that content, the way `Empty State Graphic` sits beside
  `Empty State`. The host shows its own states and the launch; the content
  entry renders every case unfolded at once, with room between them, none
  closable — never a row of triggers that each launch one variant
  (`Token Details Breakdown`).
- Keep a separate story when its point is an opened state the component
  cannot hold open in a stack (a menu opened by a `play` step, one at a time):
  long names inside the open menu are the demonstration.

## Layout of open layers

An open portaled layer takes no layout space, so a stack of open layers needs
explicit row heights. Check with real bounding boxes that no layer covers
another or its neighbor's trigger (see [verification](verification.md)).
