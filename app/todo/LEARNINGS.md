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
