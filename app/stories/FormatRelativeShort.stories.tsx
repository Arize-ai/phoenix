import type { Meta, StoryFn } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";
import {
  ONE_DAY_MS,
  ONE_HOUR_MS,
  ONE_MINUTE_MS,
} from "@phoenix/constants/timeConstants";
import { formatRelativeShort } from "@phoenix/utils/timeFormatUtils";

const meta: Meta = {
  title: "DateTime/Format Relative Short Timestamp",
  parameters: {
    layout: "centered",
  },
};

export default meta;

const NOW = new Date("2026-03-24T14:30:00").getTime();

/**
 * Each sample defines a label describing the age and a timestamp offset
 * relative to `NOW`.
 */
const SAMPLES: { label: string; offsetMs: number }[] = [
  { label: "Just now", offsetMs: 0 },
  { label: "30 seconds ago", offsetMs: 30 * 1000 },
  { label: "5 minutes ago", offsetMs: 5 * ONE_MINUTE_MS },
  { label: "30 minutes ago", offsetMs: 30 * ONE_MINUTE_MS },
  { label: "1 hour ago", offsetMs: 1 * ONE_HOUR_MS },
  { label: "3 hours ago", offsetMs: 3 * ONE_HOUR_MS },
  { label: "5 hours 59 min ago", offsetMs: 6 * ONE_HOUR_MS - ONE_MINUTE_MS },
  // ── boundary: 6h ──
  { label: "6 hours ago", offsetMs: 6 * ONE_HOUR_MS },
  { label: "8 hours ago", offsetMs: 8 * ONE_HOUR_MS },
  { label: "12 hours ago", offsetMs: 12 * ONE_HOUR_MS },
  { label: "23 hours ago", offsetMs: 23 * ONE_HOUR_MS },
  // ── boundary: 24h ──
  { label: "1 day ago", offsetMs: 1 * ONE_DAY_MS },
  { label: "2 days ago", offsetMs: 2 * ONE_DAY_MS },
  { label: "7 days ago", offsetMs: 7 * ONE_DAY_MS },
  { label: "30 days ago", offsetMs: 30 * ONE_DAY_MS },
  { label: "45 days ago", offsetMs: 45 * ONE_DAY_MS },
  { label: "365 days ago", offsetMs: 365 * ONE_DAY_MS },
  // ── edge: legacy session ──
  { label: "Legacy (timestamp 0)", offsetMs: -1 },
];

/**
 * Demonstrates the three formatting tiers of `formatCompactTimestamp`:
 *
 * | Age | Format | Example |
 * |-----|--------|---------|
 * | < 6h | locale time | 1:23 PM |
 * | 6–24h | hours | 8h |
 * | > 24h | days | 45d |
 */
export const FormattingRules: StoryFn = () => (
  <View padding="size-200">
    <Flex direction="column" gap="size-200">
      <Text size="L" weight="heavy">
        formatCompactTimestamp
      </Text>
      <Text color="text-700" size="S">
        Reference time: {new Date(NOW).toLocaleString()}
      </Text>
      <table>
        <thead>
          <tr>
            <th>Age</th>
            <th>Output</th>
            <th>Rule</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLES.map(({ label, offsetMs }) => {
            const timestamp = offsetMs === -1 ? 0 : NOW - offsetMs;
            const output = formatRelativeShort(timestamp, NOW);
            const rule = getRuleName(offsetMs);
            return (
              <tr key={label}>
                <td>
                  <Text size="S">{label}</Text>
                </td>
                <td>
                  <Text size="S" weight="heavy">
                    {output || <em>empty string</em>}
                  </Text>
                </td>
                <td>
                  <Text size="XS" color="text-300">
                    {rule}
                  </Text>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Flex>
  </View>
);

function getRuleName(offsetMs: number): string {
  if (offsetMs === -1) return "timestamp 0 → empty";
  if (offsetMs < 6 * ONE_HOUR_MS) return "< 6h → locale time";
  if (offsetMs < ONE_DAY_MS) return "6–24h → hours";
  return "> 24h → days";
}
