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
- status: pending
- dependencies: example-id-link-stop-propagation

### implement-shift-click-range-select

- content: Implement shift-click range selection in ExamplesTable.tsx. When shift+click is detected on a row, select all rows between the last clicked row and the current row (inclusive). Use the tracked last-selected-row index. If no previous row was selected, treat it as a normal click.
- status: pending
- dependencies: track-last-selected-row
