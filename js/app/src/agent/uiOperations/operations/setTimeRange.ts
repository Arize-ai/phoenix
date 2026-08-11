import { z } from "zod";

import type { TimeRangeKey } from "@phoenix/components/datetime/types";

import { defineUiOperation } from "../types";

/**
 * Presets the model may request. `satisfies` guarantees every entry is a valid
 * `TimeRangeKey`; this list is now the only place the enum is written down.
 *
 * Before this RFC the same enum lived in three places with drift-warning
 * comments pointing at each other:
 *   - `src/phoenix/server/agents/capabilities/tools/external/set_time_range.py`
 *   - `app/src/agent/tools/timeRange/constants.ts`
 *   - `parseSetTimeRangeInput` in `app/src/agent/tools/timeRange/parsers.ts`
 */
const TIME_RANGE_KEY_VALUES = [
  "15m",
  "1h",
  "12h",
  "1d",
  "7d",
  "30d",
  "custom",
] as const satisfies readonly TimeRangeKey[];

/**
 * Input schema for `timeRange.set`. Strict (unknown keys rejected) to match
 * the server schema's `additionalProperties: false` and to surface
 * hallucinated parameters as errors instead of silently ignoring them.
 * `.describe()` text flows into both the JSON schema the server advertises
 * and the signature `search_ui` renders.
 */
const setTimeRangeInputSchema = z.strictObject({
  timeRangeKey: z
    .enum(TIME_RANGE_KEY_VALUES)
    .describe(
      "Preset to apply, or `custom` when specifying explicit start/end times. " +
        "Use the current local date/time from the `get_current_datetime` tool " +
        "when resolving relative user requests like 'today', 'yesterday', or " +
        "'last hour'."
    ),
  startTime: z
    .string()
    .optional()
    .describe(
      "Optional ISO 8601 start datetime for a custom range. Include a " +
        "timezone offset or `Z` when possible; otherwise the browser " +
        "interprets it in the user's local timezone."
    ),
  endTime: z
    .string()
    .optional()
    .describe(
      "Optional ISO 8601 end datetime for a custom range. Omit for " +
        "open-ended ranges such as 'since 9am'."
    ),
});

export type SetTimeRangeOperationInput = z.infer<
  typeof setTimeRangeInputSchema
>;

/**
 * The catalog entry replacing the `set_time_range` client-action tool. The
 * description below moves here verbatim from the Python `DESCRIPTION`; the
 * handler stays where it is today (registered by `TimeRangeContext` while a
 * time range provider is mounted) but is registered via
 * `registerUiOperation` against this descriptor instead of
 * `registerClientAction` — see PLAN.md for the before/after diff.
 */
export const setTimeRangeOperation = defineUiOperation({
  name: "timeRange.set",
  description:
    "Set the Phoenix app time range selector. Use preset `timeRangeKey` values " +
    "for standard relative windows (15m, 1h, 12h, 1d, 7d, 30d). Use `custom` " +
    "with `startTime` and optional `endTime` for specific calendar windows. " +
    "Call the `get_current_datetime` tool first to read the current date/time " +
    "in the user's browser timezone; base relative calendar phrases on that " +
    "value — never on prior knowledge or on the currently selected time range.",
  inputSchema: setTimeRangeInputSchema,
  kind: "write",
  defaultSuccessOutput: "Time range updated.",
  availability: {
    routeHint:
      "any page with the app time range selector (e.g. a project's traces page)",
  },
});
