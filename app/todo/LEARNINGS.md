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
