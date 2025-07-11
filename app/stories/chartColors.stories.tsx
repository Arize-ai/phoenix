import type { Meta, StoryObj } from "@storybook/react";
import { css } from "@emotion/react";

import { Text, View } from "@phoenix/components";
import { useChartColors } from "@phoenix/components/chart";

const colorGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, 140px);
  gap: var(--ac-global-dimension-size-100);
  padding: var(--ac-global-dimension-size-100);
  justify-content: start;
`;

const colorSwatchCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-75);
  padding: var(--ac-global-dimension-size-100);
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-rounding-medium);
  background-color: var(--ac-global-color-grey-50);
  min-width: 0; /* Prevent flex items from overflowing */
`;

const colorCircleCSS = css`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--ac-global-color-grey-200);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
`;

const colorInfoCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-25);
  min-width: 0;
  flex: 1;
`;

const colorValueCSS = css`
  font-family: var(--ac-global-font-family-code);
  font-size: var(--ac-global-dimension-font-size-50);
  color: var(--ac-global-text-color-700);
  background-color: var(--ac-global-color-grey-100);
  padding: var(--ac-global-dimension-size-25) var(--ac-global-dimension-size-50);
  border-radius: var(--ac-global-rounding-small);
  border: 1px solid var(--ac-global-color-grey-200);
  word-break: break-all;
  overflow-wrap: break-word;
`;

const colorGroupCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
`;

const colorGroupHeaderCSS = css`
  padding: var(--ac-global-dimension-size-75) 0
    var(--ac-global-dimension-size-50);
  border-bottom: 1px solid var(--ac-global-color-grey-200);
  margin-bottom: var(--ac-global-dimension-size-75);
`;

interface ColorSwatchProps {
  name: string;
  color: string;
}

function ColorSwatch({ name, color }: ColorSwatchProps) {
  return (
    <div css={colorSwatchCSS}>
      <div css={colorCircleCSS} style={{ backgroundColor: color }} />
      <div css={colorInfoCSS}>
        <Text weight="heavy" size="XS">
          {name}
        </Text>
        <code css={colorValueCSS}>{color}</code>
      </div>
    </div>
  );
}

interface ChartColorsProps {
  showOnlyPrimary?: boolean;
}

function ChartColors({ showOnlyPrimary = false }: ChartColorsProps) {
  const colors = useChartColors();

  // Get all color entries and sort them
  const colorEntries = Object.entries(colors).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // Filter to primary colors if requested
  const displayColors = showOnlyPrimary
    ? colorEntries.filter(
        ([name]) =>
          !name.includes("100") &&
          !name.includes("200") &&
          !name.includes("300") &&
          !name.includes("400") &&
          !name.includes("600") &&
          !name.includes("700") &&
          !name.includes("800") &&
          !name.includes("900")
      )
    : colorEntries;

  // Group colors by their base name (e.g., "blue", "green", "red")
  const groupedColors = displayColors.reduce(
    (groups, [name, color]) => {
      // Extract base color name (remove numbers and common suffixes)
      const baseName = name.replace(/\d+$/, "").replace(/[A-Z].*$/, "");

      if (!groups[baseName]) {
        groups[baseName] = [];
      }
      groups[baseName].push([name, color]);
      return groups;
    },
    {} as Record<string, [string, string][]>
  );

  // Sort groups by base name, but put default, primary, and reference at the bottom
  const bottomGroups = ["default", "primary", "reference"];
  const sortedGroups = Object.entries(groupedColors).sort(([a], [b]) => {
    const aIsBottom = bottomGroups.includes(a);
    const bIsBottom = bottomGroups.includes(b);

    // If both are bottom groups, sort by the order in bottomGroups array
    if (aIsBottom && bIsBottom) {
      return bottomGroups.indexOf(a) - bottomGroups.indexOf(b);
    }

    // If only one is a bottom group, put it at the end
    if (aIsBottom) return 1;
    if (bIsBottom) return -1;

    // For regular groups, sort alphabetically
    return a.localeCompare(b);
  });

  return (
    <View>
      <View paddingBottom="size-100">
        <Text elementType="h2" weight="heavy" size="L">
          Chart Colors
        </Text>
        <Text color="text-700">
          Colors available from the <code>useChartColors</code> hook for chart
          components.
        </Text>
      </View>
      <div css={colorGroupCSS}>
        {sortedGroups.map(([groupName, groupColors]) => (
          <div key={groupName}>
            <div css={colorGroupHeaderCSS}>
              <Text elementType="h3" weight="heavy" size="S">
                {groupName.charAt(0).toUpperCase() + groupName.slice(1)} Colors
              </Text>
            </div>
            <div css={colorGridCSS}>
              {groupColors.map(([name, color]) => (
                <ColorSwatch key={name} name={name} color={color} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </View>
  );
}

const meta: Meta<typeof ChartColors> = {
  title: "charts/Chart Colors",
  component: ChartColors,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
Chart colors are provided by the \`useChartColors\` hook and are used consistently across all chart components in Phoenix. 
These colors are designed to be accessible and provide good contrast for data visualization.

## Usage

\`\`\`tsx
import { useChartColors } from "@phoenix/components/chart";

function MyChart() {
  const colors = useChartColors();
  
  return (
    <Bar dataKey="value" fill={colors.blue500} />
  );
}
\`\`\`
        `,
      },
    },
  },
  argTypes: {
    showOnlyPrimary: {
      control: { type: "boolean" },
      description:
        "Show only primary colors (500 variants) without lighter/darker shades",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChartColors>;

export const AllColors: Story = {
  args: {
    showOnlyPrimary: false,
  },
};

export const PrimaryColors: Story = {
  args: {
    showOnlyPrimary: true,
  },
};
