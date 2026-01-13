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
