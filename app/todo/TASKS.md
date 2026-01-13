# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Row Click Behavior Changes

### row-click-toggle-selection

- content: Change the row click handler in ExamplesTable.tsx to toggle checkbox selection instead of navigating to the example dialog. The current `onClick={() => navigate(...)}` on the `<tr>` should instead call `row.toggleSelected()`. This makes clicking anywhere on the row toggle its selection state.
- status: complete
- dependencies: none

### example-id-link-stop-propagation

- content: Update the example ID Link cell in ExamplesTable.tsx to stop event propagation when clicked, so clicking the link opens the example dialog without also toggling the row selection. Add `onClick={(e) => e.stopPropagation()}` to the Link component in the example ID column definition.
- status: complete
- dependencies: row-click-toggle-selection

---

## Phase 2: Shift-Click Multi-Select

### track-last-selected-row

- content: Add state to ExamplesTable.tsx to track the index of the last clicked row for shift-click range selection. Use a `useRef` to store the last selected row index. Update this ref whenever a row is clicked (single click without shift).
- status: complete
- dependencies: example-id-link-stop-propagation

### implement-shift-click-range-select

- content: Implement shift-click range selection in ExamplesTable.tsx. When shift+click is detected on a row, select all rows between the last clicked row and the current row (inclusive). Use the tracked last-selected-row index. If no previous row was selected, treat it as a normal click.
- status: complete
- dependencies: track-last-selected-row

---

## Phase 3: Bug Fixes - Selection Behavior

### remove-row-click-handler

- content: Remove the onClick handler from the `<tr>` element in ExamplesTable.tsx. The row body should no longer toggle selection when clicked - only the checkbox cell should handle selection. This fixes the bug where selecting text on the row also toggles selection.
- status: complete
- dependencies: implement-shift-click-range-select

### create-row-selection-handler

- content: Create a shared row selection handler function in ExamplesTable.tsx that handles both normal clicks and shift-clicks. This function should: (1) always update `lastSelectedRowIndexRef` to the current row index, (2) if shift+click with a previous anchor, call `addRangeToSelection` for range selection, (3) otherwise toggle the single row's selection. Extract this logic from the current row onClick handler.
- status: complete
- dependencies: remove-row-click-handler

### expand-checkbox-cell-click-target

- content: Expand the clickable area in IndeterminateCheckboxCell to fill the entire cell by increasing padding. The component already has padding, but it should be increased so that the checkbox cell covers the full `<td>` area. Update the CSS padding in the wrapper div to use larger values (e.g., `var(--ac-global-dimension-size-100)` or similar).
- status: complete
- dependencies: create-row-selection-handler

### wire-checkbox-cell-to-row-handler

- content: Update the checkbox column definition in ExamplesTable.tsx to pass the shared row selection handler and row index to IndeterminateCheckboxCell. Modify IndeterminateCheckboxCell to accept an optional `onCellClick` callback prop that receives the click event. When provided, call this handler instead of the default `onChange` toggle behavior. The ExamplesTable checkbox column should pass a handler that calls the shared row selection handler with the event and row index.
- status: complete
- dependencies: expand-checkbox-cell-click-target
