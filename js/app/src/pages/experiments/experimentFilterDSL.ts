import type { Completion } from "@codemirror/autocomplete";
import { snippetCompletion } from "@codemirror/autocomplete";

import type { DSLFilterSnippet } from "@phoenix/components/filter";

/**
 * The experiment filter vocabulary, matching the names `ExperimentFilter`
 * binds on the server.
 */
export const experimentFilterCompletions: Completion[] = [
  {
    label: "name",
    type: "variable",
    detail: "string",
    info: "The experiment's name. `in` ignores case; `==` is exact.",
  },
  {
    label: "description",
    type: "variable",
    detail: "string",
    info: "The experiment's description. `in` ignores case; `==` is exact.",
  },
  {
    label: "project_name",
    type: "variable",
    detail: "string",
    info: "The name of the project that holds the experiment's traces.",
  },
  {
    label: "repetitions",
    type: "variable",
    detail: "number",
    info: "How many times the experiment runs each example.",
  },
  {
    label: "created_at",
    type: "variable",
    detail: "datetime",
    info: "When the experiment was created, as an ISO 8601 string such as 2026-07-01T00:00:00Z.",
  },
  {
    label: "updated_at",
    type: "variable",
    detail: "datetime",
    info: "When the experiment was last updated, as an ISO 8601 string such as 2026-07-01T00:00:00Z.",
  },
  snippetCompletion('metadata["${key}"]', {
    label: 'metadata["key"]',
    type: "variable",
    detail: "json",
    info: 'A value in the experiment\'s metadata. Each subscript is one key, so metadata["a"]["b"] reads b nested under a.',
  }),
];

export const experimentFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "match a metadata value",
    snippet: 'metadata["${key}"] == "${value}"',
    boost: 1,
  },
  {
    label: "search names for text",
    snippet: '"${text}" in name',
  },
  {
    label: "created after a date",
    snippet: 'created_at > "${2026-01-01T00:00:00Z}"',
  },
];
