import type { Meta, StoryObj } from "@storybook/react";
import { css } from "@emotion/react";

import { Text, View } from "@phoenix/components";
import { useChartColors } from "@phoenix/components/chart";

const colorGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--ac-global-dimension-size-200);
  padding: var(--ac-global-dimension-size-200);
`;

const colorSwatchCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  padding: var(--ac-global-dimension-size-150);
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-rounding-medium);
  background-color: var(--ac-global-color-grey-50);
`;

const colorCircleCSS = css`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--ac-global-color-grey-200);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const colorInfoCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
`;

const colorValueCSS = css`
  font-family: var(--ac-global-font-family-code);
  font-size: var(--ac-global-dimension-font-size-75);
  color: var(--ac-global-text-color-700);
  background-color: var(--ac-global-color-grey-100);
  padding: var(--ac-global-dimension-size-50) var(--ac-global-dimension-size-75);
  border-radius: var(--ac-global-rounding-small);
  border: 1px solid var(--ac-global-color-grey-200);
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
        <Text weight="heavy" size="S">
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

  return (
    <View>
      <View paddingBottom="size-200">
        <Text elementType="h2" weight="heavy" size="L">
          Chart Colors
        </Text>
        <Text color="text-700">
          Colors available from the <code>useChartColors</code> hook for chart
          components.
        </Text>
      </View>
      <div css={colorGridCSS}>
        {displayColors.map(([name, color]) => (
          <ColorSwatch key={name} name={name} color={color} />
        ))}
      </div>
    </View>
  );
}

const meta: Meta<typeof ChartColors> = {
  title: "Design System/Chart Colors",
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

export const Documentation: Story = {
  args: {
    showOnlyPrimary: false,
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates all available chart colors with their color values. 
Each color swatch shows the color name and its corresponding hex/rgb value.

The colors are organized alphabetically and include various shades of:
- **Blue**: Primary brand colors
- **Red**: Error and warning states  
- **Green**: Success and positive states
- **Gray**: Neutral colors for backgrounds and text
- **Orange/Yellow**: Warning and highlight colors
- **Purple**: Secondary accent colors

Use these colors consistently across charts to maintain visual coherence in the Phoenix design system.
        `,
      },
    },
  },
};
