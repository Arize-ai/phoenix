# Layout & Interaction

## Layout stability

Loading states MUST use skeleton loaders so the page does not shift between loading and loaded states.

## Scroll behavior

Pages SHOULD have only one scrollable region. Scroll traps where the user's scroll gets captured by a nested container MUST be avoided.

## Interaction patterns

Each action MUST have one method of invocation. Confirm/cancel SHOULD be placed at the bottom of a dialog — controls MUST NOT be duplicated across header, footer, and shortcuts. Exception: dialog close buttons MAY appear in both the top-right corner and the footer.

Row actions (e.g. delete, edit) for simple list or menu items MUST be always visible. Hiding actions behind hover states reduces discoverability and is inaccessible to touch users.

## Copy affordances

A `Card` whose body holds content worth copying MUST offer a copy button in its header's `extra` slot, and that button MUST be the last control in the slot so it lands in the same place on every card. Copy MUST NOT be placed inside the card body — a reader should never have to hunt for it, or hover to find it.

A card copies what it is currently showing. Where a card holds a list of items that are themselves cards (messages, documents, tool schemas), the outer card copies the whole list and each item card copies its own content.

## Tree connector lines

Trees that draw lines between parent and child rows (the trace tree, its skeleton) MUST follow these rules so the lines read as one continuous structure.

- **One color, one place.** All lines read a single CSS variable (`--trace-tree-line-color`, defaulting to `--global-color-gray-300`) declared on the tree root. An error path overrides that variable; it MUST NOT introduce a second color token. Line color MUST be set with longhands (`border-color`, `border-left-width`): the `border-left: 1px solid` shorthand silently resets the color to `currentColor`.
- **Lines meet edge to edge.** Each segment starts exactly where the previous one ends. A parent row draws the drop from its icon's bottom to the row's bottom; a list item draws the run between siblings over its full height; a child row draws the elbow from its top to its icon's center. No segment MAY overshoot into a neighbor to hide a gap.
- **The icon is the anchor, and lines point at it without touching it.** Lines aim at the center of the span kind icon, which is centered on the title line, and stop one gap (`LINE_GAP`) short of its edge on every side: the elbow ends a gap before the icon's left edge and the drop starts a gap below its bottom edge. The gap MUST be the same constant everywhere so the icon reads as a node the lines point at, not one they pierce. Rows MAY vary in height below the title line (a metrics footer, wrapped content) without moving the anchor, so the geometry MUST be expressed from the row's top, never as a percentage of its height.
- **Geometry lives in one module.** Offsets (indent per level, padding, icon size, elbow size) are constants or CSS variables in `traceTreeStyles.ts`. Depth reaches the styles through one custom property on the row and list item, so the styles are static and compiled once. Components MUST NOT re-derive an offset with their own arithmetic.
- **Lines sit above row fills.** A row is positioned so its lines can anchor to it, and it gains a background on hover and selection. Lines therefore MUST carry a z-index above the row (`TREE_LINE_Z_INDEX`), error lines above neutral ones, and the icon above every line, or the fill will break the line on hover. Verify by hovering and selecting a nested row.
- **Skeletons render the real lines.** A loading skeleton MUST compose the same line components and row styles as the tree rather than copy them, so it cannot drift.
