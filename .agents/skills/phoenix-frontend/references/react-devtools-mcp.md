# React DevTools MCP

The Vite dev server injects [`react-devtools-cdt-mcp`](https://www.npmjs.com/package/react-devtools-cdt-mcp) into the app entry (see `js/app/vite/reactDevtoolsMcpPlugin.mts`). It registers a `react` tool group that [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) discovers on the page. Production builds do not include it.

Use it to find which component rendered an element, read props and hooks, and measure render cost of an interaction.

It needs the dev server and Chrome DevTools MCP with third-party tools enabled. Setup is under "React DevTools MCP" in `js/app/README.md`. If `list_3p_developer_tools` shows no `react_*` tools, tell the user the setup is missing instead of working around it.

Call a tool with `execute_3p_developer_tool({ toolName, params })`, or with `evaluate_script` and `window.__dtmcp.executeTool(toolName, params)`.

## Profile an interaction

1. `react_start_profiling` with a `traceName`.
2. Do the interaction (click, type, navigate).
3. `react_stop_profiling`.
4. `react_get_trace_overview` with the `traceName`. Find the commits with the largest `renderDuration`.
5. `react_get_commit_report` with the `traceName` and `commitIndex`. Components are sorted by `actualDuration`. A large `selfDuration` points at the component's own render. A large `actualDuration` with a small `selfDuration` points at its subtree.

Compare a trace before and after the change. Durations come from a dev build with the hook attached, so use them as relative numbers, not absolute.

Trust the commit count and `renderDuration`. Do not trust the component list in `react_get_commit_report` or the `componentsChanged` count. In 0.1.0 they also include components from subtrees that did not re-render, with timings from an earlier render. To find which components rendered in a commit, wrap `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot`, then walk from `root.current` and its `alternate`. Recurse only where `next.child !== prev.child`, and count a component as rendered when its `flags & 1` (PerformedWork) bit is set.

## Inspect components

- `react_get_component_by_dom_element`: start from an element on screen.
- `react_find_components` with `name`: search by component name. React Compiler components show as `Forget(Name)`.
- `react_get_component_by_uid` with `includeHooks: true`: props and hook values.
- `react_get_owner_stack`, `react_get_component_source`: which JSX created a component and where it is defined.

Uids such as `r5` stay stable across re-renders but not across page reloads. After a reload, find components again.
