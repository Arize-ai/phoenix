# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## row-click-toggle-selection

- The ExamplesTable uses `@tanstack/react-table` which provides `row.toggleSelected()` method on each row object
- When removing the navigation behavior, also need to remove both the `useNavigate` import and the `const navigate = useNavigate()` call to keep the code clean
- The table's row selection state is managed via `rowSelection` and `setRowSelection` which are wired to the context's `selectedExampleIds`
- The next task (example-id-link-stop-propagation) will need to add `onClick={(e) => e.stopPropagation()}` to the Link in the example ID column to prevent the new row click handler from toggling selection when clicking the link

## example-id-link-stop-propagation

- The Link component in the example ID column cell is at line ~199 in ExamplesTable.tsx, inside the column definition for "example id"
- Adding `onClick={(e) => e.stopPropagation()}` to the Link prevents the click event from bubbling up to the parent `<tr>` element which has the row selection toggle handler
- The custom Link component from `@phoenix/components/Link` accepts an onClick prop that types correctly with React.MouseEvent
- The next task (track-last-selected-row) will need to add a `useRef` to track the last clicked row index for shift-click range selection

## track-last-selected-row

- Added `lastSelectedRowIndexRef` using `useRef<number | null>(null)` to track the index of the last clicked row
- The `rows.map()` callback provides a `rowIndex` parameter which is the index in the visible rows array - perfect for range selection
- The ref is updated only when `!e.shiftKey` - this ensures shift-clicks don't overwrite the anchor point for range selection
- The row click handler now receives the event as `(e)` instead of `()` to check for the shift key
- No unit test needed for this change since it's internal state management with no observable behavior change yet - the actual behavior (shift-click range selection) will be tested in the next task
- The next task (implement-shift-click-range-select) will use `lastSelectedRowIndexRef.current` to determine the range of rows to select

## implement-shift-click-range-select

- Extracted the range selection logic into a reusable utility function `addRangeToSelection` in `src/components/table/selectionUtils.ts`
- The utility function works with any array of items that have an `id` property, making it reusable for other tables
- Shift-click behavior: when shift+click is detected and there's a previous anchor point, select all rows from the anchor to the clicked row (inclusive)
- The function handles both directions (lower to higher index and higher to lower index) by using `Math.min/max`
- The function preserves existing selections - it adds to the selection rather than replacing it
- Used the non-null assertion `lastSelectedRowIndexRef.current!` since we already checked for null in the condition
- Normal clicks (without shift) update the anchor point and toggle the row; shift-clicks don't update the anchor point to enable multiple sequential range selections from the same anchor

## remove-row-click-handler

- This task is the first step in Phase 3: Bug Fixes - fixing the issue where selecting text on the row also toggles selection
- Removing the onClick handler from `<tr>` is a breaking change for selection - clicking anywhere on the row no longer selects it
- The selection logic (including shift-click range selection from `implement-shift-click-range-select`) is temporarily removed but will be re-added in the next task (`create-row-selection-handler`) via the checkbox cell
- The `rowIndex` parameter in `rows.map()` is no longer needed since the click handler is removed, so the callback now just receives `row`
- The `lastSelectedRowIndexRef` and `addRangeToSelection` imports are still present in the file and will be needed by subsequent tasks
- No unit tests needed for this task since it's a behavioral change (removing functionality) that will be immediately restored in the next task via a different mechanism

## create-row-selection-handler

- Created `handleRowSelection` as a `useCallback` that takes `(event: React.MouseEvent, rowIndex: number, row)` as parameters
- The handler encapsulates all selection logic: shift-click range selection and normal toggle, plus always updating the anchor point
- Used `(typeof rows)[number]` to type the `row` parameter correctly to access `row.toggleSelected()`
- The handler is now ready to be passed to IndeterminateCheckboxCell in subsequent tasks (`expand-checkbox-cell-click-target` and `wire-checkbox-cell-to-row-handler`)
- Dependencies for the useCallback are `[setRowSelection, tableData]` - no need to include `lastSelectedRowIndexRef` since refs are stable across renders
- No new tests needed since this is just extracting logic into a reusable function - the actual behavior will be tested once it's wired up to the checkbox cell

## expand-checkbox-cell-click-target

- The IndeterminateCheckboxCell component is located at `src/components/table/IndeterminateCheckboxCell.tsx`
- The component already had padding (`var(--ac-global-dimension-size-25)` = 2px) but it was too small for easy clicking
- Changed padding from `size-25` (2px) to `size-100` (8px) to create a larger clickable area around the checkbox
- The design system's size variables are defined in `src/GlobalStyles.tsx` (size-25=2px, size-50=4px, size-100=8px, size-150=12px, etc.)
- The component already has `e.stopPropagation()` on its onClick handler to prevent conflicts with table row click events
- This is a simple CSS change with no behavioral logic change - no new tests needed
- The next task (`wire-checkbox-cell-to-row-handler`) will modify this component to accept an optional `onCellClick` callback for the shared row selection handler

## wire-checkbox-cell-to-row-handler

- Added `onCellClick?: (event: React.MouseEvent) => void` prop to IndeterminateCheckboxCell using a new `IndeterminateCheckboxCellProps` type that extends `CheckboxProps`
- Used object destructuring with rest props: `{ onCellClick, ...checkboxProps }` to cleanly separate the new prop from the standard checkbox props
- The `onCellClick` is called instead of `onChange` when provided, giving the parent full control over click behavior
- In ExamplesTable.tsx, the `handleRowSelection` function was moved before `columns` to avoid "used before declaration" error since `columns` depends on it
- Changed `handleRowSelection` signature to take `toggleSelected: (value?: boolean) => void` instead of the full `row` object - this is cleaner and more explicit about what the handler needs
- The checkbox cell's `onCellClick` callback passes `row.toggleSelected` to `handleRowSelection`, enabling the shared handler to toggle selection for normal clicks
- The header checkbox (for "select all") doesn't need `onCellClick` since it always toggles all rows - no shift-click range behavior needed there
- This completes Phase 3 of the bug fixes - selection now only happens via the checkbox cell, preventing accidental selection when selecting text on the row

## fix-checkbox-direct-click

- The issue was that react-aria-components' Checkbox contains a hidden `<input type="checkbox">` that captures click events before they reach the wrapper div's onClick handler
- Solution: Add `pointer-events: none` CSS to the Checkbox component when `onCellClick` is provided, ensuring all clicks pass through to the wrapper div
- The fix is conditionally applied only when `onCellClick` is provided, preserving default behavior for checkboxes without custom click handling
- Used inline CSS via emotion's `css` prop to conditionally apply the style based on the presence of `onCellClick`
- This approach is cleaner than modifying the Checkbox component's internal structure or adding a new prop to handle click events
- The header checkbox (select all) doesn't have `onCellClick` so it still works normally with its default onChange behavior
- This completes Phase 4 (Final Bug Fixes) - all checkbox selection behavior now works correctly including shift-click range selection
