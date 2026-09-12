import invariant from "tiny-invariant";

/**
 * How far back a project evaluator's matching-record preview looks. Shared by
 * the project evaluator scope panel and the evaluator playground's project
 * source, which persists the preset id in the URL.
 */
export const TIME_WINDOW_PRESETS = [
  {
    id: "1h",
    label: "Last hour",
    shortLabel: "1h",
    prose: "in the last hour",
    ms: 3_600_000,
  },
  {
    id: "24h",
    label: "Last 24 hours",
    shortLabel: "24h",
    prose: "in the last 24 hours",
    ms: 86_400_000,
  },
  {
    id: "7d",
    label: "Last 7 days",
    shortLabel: "7d",
    prose: "in the last 7 days",
    ms: 7 * 86_400_000,
  },
  {
    id: "30d",
    label: "Last 30 days",
    shortLabel: "30d",
    prose: "in the last 30 days",
    ms: 30 * 86_400_000,
  },
] as const;

export type TimeWindowPresetId = (typeof TIME_WINDOW_PRESETS)[number]["id"];

export const DEFAULT_TIME_WINDOW_PRESET_ID: TimeWindowPresetId = "7d";

export const isTimeWindowPresetId = (
  value: string
): value is TimeWindowPresetId =>
  TIME_WINDOW_PRESETS.some(({ id }) => id === value);

/**
 * `startIso` is computed once when the preset is chosen so re-renders do not
 * shift the window and refire the queries.
 */
export type TimeWindow = {
  presetId: TimeWindowPresetId;
  prose: string;
  startIso: string;
};

export function makeTimeWindow(presetId: TimeWindowPresetId): TimeWindow {
  const preset = TIME_WINDOW_PRESETS.find(({ id }) => id === presetId);
  invariant(preset, `unknown time window preset: ${presetId}`);
  return {
    presetId,
    prose: preset.prose,
    startIso: new Date(Date.now() - preset.ms).toISOString(),
  };
}
