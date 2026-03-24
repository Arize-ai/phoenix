import type { Meta, StoryFn } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";
import { formatRelativeShort } from "@phoenix/utils/timeFormatUtils";

const meta: Meta = {
  title: "DateTime/Format Relative Short Timestamp",
  parameters: {
    layout: "centered",
  },
};

export default meta;

const MS_PER_MINUTE = 1000 * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

const NOW = new Date("2026-03-24T14:30:00").getTime();

/**
 * Each sample defines a label describing the age and a timestamp offset
 * relative to `NOW`.
 */
const SAMPLES: { label: string; offsetMs: number }[] = [
  { label: "Just now", offsetMs: 0 },
  { label: "30 seconds ago", offsetMs: 30 * 1000 },
  { label: "5 minutes ago", offsetMs: 5 * MS_PER_MINUTE },
  { label: "30 minutes ago", offsetMs: 30 * MS_PER_MINUTE },
  { label: "1 hour ago", offsetMs: 1 * MS_PER_HOUR },
  { label: "3 hours ago", offsetMs: 3 * MS_PER_HOUR },
  { label: "5 hours 59 min ago", offsetMs: 6 * MS_PER_HOUR - MS_PER_MINUTE },
  // ── boundary: 6h ──
  { label: "6 hours ago", offsetMs: 6 * MS_PER_HOUR },
  { label: "8 hours ago", offsetMs: 8 * MS_PER_HOUR },
  { label: "12 hours ago", offsetMs: 12 * MS_PER_HOUR },
  { label: "23 hours ago", offsetMs: 23 * MS_PER_HOUR },
  // ── boundary: 24h ──
  { label: "1 day ago", offsetMs: 1 * MS_PER_DAY },
  { label: "2 days ago", offsetMs: 2 * MS_PER_DAY },
  { label: "7 days ago", offsetMs: 7 * MS_PER_DAY },
  { label: "30 days ago", offsetMs: 30 * MS_PER_DAY },
  { label: "45 days ago", offsetMs: 45 * MS_PER_DAY },
  { label: "365 days ago", offsetMs: 365 * MS_PER_DAY },
  // ── edge: legacy session ──
  { label: "Legacy (timestamp 0)", offsetMs: -1 },
];

const cellStyle: React.CSSProperties = {
  padding: "6px 16px",
  borderBottom: "1px solid var(--global-border-color-default)",
  whiteSpace: "nowrap",
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  borderBottom: "2px solid var(--global-border-color-default)",
  fontWeight: 600,
};

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
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <td style={headerCellStyle}>Age</td>
            <td style={headerCellStyle}>Output</td>
            <td style={headerCellStyle}>Rule</td>
          </tr>
        </thead>
        <tbody>
          {SAMPLES.map(({ label, offsetMs }) => {
            const timestamp = offsetMs === -1 ? 0 : NOW - offsetMs;
            const output = formatRelativeShort(timestamp, NOW);
            const rule = getRuleName(offsetMs);
            return (
              <tr key={label}>
                <td style={cellStyle}>
                  <Text size="S">{label}</Text>
                </td>
                <td style={cellStyle}>
                  <Text size="S" weight="heavy">
                    {output || <em>empty string</em>}
                  </Text>
                </td>
                <td style={cellStyle}>
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
  if (offsetMs < 6 * MS_PER_HOUR) return "< 6h → locale time";
  if (offsetMs < MS_PER_DAY) return "6–24h → hours";
  return "> 24h → days";
}
