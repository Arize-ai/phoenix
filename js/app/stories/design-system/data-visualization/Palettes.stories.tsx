import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";
import { useSequentialChartColors } from "@phoenix/components/chart";
import {
  CATEGORICAL_CHART_COLORS,
  GRAYSCALE_CATEGORICAL_COLORS,
  SEMANTIC_CHART_COLORS,
  useCategoryChartColors,
  useGrayscaleCategoricalColors,
  useSemanticChartColors,
} from "@phoenix/components/chart/colors";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/core/tooltip";

const colorGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, 140px);
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100);
  justify-content: start;
`;

const colorSwatchCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-75);
  padding: var(--global-dimension-size-100);
  border: 1px solid var(--global-color-gray-300);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-color-gray-50);
  min-width: 0; /* Prevent flex items from overflowing */
`;

const colorCircleCSS = css`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--global-color-gray-200);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
`;

const colorInfoCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
  min-width: 0;
  flex: 1;
`;

const colorValueCSS = css`
  font-family: var(--global-font-family-code);
  font-size: var(--global-dimension-font-size-50);
  color: var(--global-text-color-700);
  background-color: var(--global-color-gray-100);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-50);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-color-gray-200);
  word-break: break-all;
  overflow-wrap: break-word;
`;

const colorGroupCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const colorGroupHeaderCSS = css`
  padding: var(--global-dimension-size-75) 0 var(--global-dimension-size-50);
  border-bottom: 1px solid var(--global-color-gray-200);
  margin-bottom: var(--global-dimension-size-75);
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

interface SequentialChartColorsProps {
  showOnlyPrimary?: boolean;
}

function SequentialChartColors({
  showOnlyPrimary = false,
}: SequentialChartColorsProps) {
  const colors = useSequentialChartColors();

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
  const groupedColors = displayColors.reduce<
    Record<string, [string, string][]>
  >((groups, [name, color]) => {
    // Extract base color name (remove numbers and common suffixes)
    const baseName = name.replace(/\d+$/, "").replace(/[A-Z].*$/, "");

    if (!groups[baseName]) {
      groups[baseName] = [];
    }
    groups[baseName].push([name, color]);
    return groups;
  }, {});

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
          Sequential Chart Colors
        </Text>
        <Text color="text-700">
          Colors available from the <code>useSequentialChartColors</code> hook
          for chart components.
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

/**
 * The three color palettes Phoenix charts draw with, each from its own hook:
 * sequential ramps (`useSequentialChartColors`) for shaded scales, categorical
 * colors (`useCategoryChartColors`, plus a grayscale set from
 * `useGrayscaleCategoricalColors`) for distinguishing series, and semantic
 * colors (`useSemanticChartColors`) for danger, success, warning, and info.
 */
const meta: Meta<typeof SequentialChartColors> = {
  title: "Design System/Data visualization/Palettes",
  tags: ["legacy", "unreviewed"],
  component: SequentialChartColors,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
Chart colors come from hooks in \`@phoenix/components/chart\` and are used consistently across all chart components in Phoenix.
These colors are designed to be accessible and provide good contrast for data visualization.

- **Sequential** — \`useSequentialChartColors\`: ramps of lighter and darker shades per hue.
- **Categorical** — \`useCategoryChartColors\` and \`useGrayscaleCategoricalColors\`: distinct colors for series.
- **Semantic** — \`useSemanticChartColors\`: danger, success, warning, and info.

## Usage

\`\`\`tsx
import { useSequentialChartColors } from "@phoenix/components/chart";

function MyChart() {
  const colors = useSequentialChartColors();
  
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
type Story = StoryObj<typeof SequentialChartColors>;

/** Every shade of every sequential ramp. */
export const Sequential: Story = {
  args: {
    showOnlyPrimary: false,
  },
};

/** Only the 500 shade of each sequential ramp. */
export const SequentialPrimary: Story = {
  args: {
    showOnlyPrimary: true,
  },
};

function CategoricalChartColors() {
  const colors = useCategoryChartColors();
  return (
    <Flex direction="column" gap="size-100">
      {CATEGORICAL_CHART_COLORS.map((colorKey) => (
        <TooltipTrigger key={colorKey} delay={0}>
          <TriggerWrap>
            <div
              style={{
                backgroundColor: colors[colorKey],
                height: "40px",
                width: "40px",
                padding: "var(--global-dimension-size-50)",
              }}
            />
          </TriggerWrap>
          <Tooltip>{colorKey}</Tooltip>
        </TooltipTrigger>
      ))}
    </Flex>
  );
}

/** The categorical palette, in order. Hover a swatch for its key. */
export const Categorical: Story = {
  parameters: { controls: { disable: true } },
  render: () => <CategoricalChartColors />,
};

function GrayscaleCategoricalChartColors() {
  const colors = useGrayscaleCategoricalColors();
  return (
    <Flex direction="column" gap="size-100">
      {GRAYSCALE_CATEGORICAL_COLORS.map((colorKey) => (
        <TooltipTrigger key={colorKey} delay={0}>
          <TriggerWrap>
            <div
              style={{
                backgroundColor: colors[colorKey],
                height: "40px",
                width: "40px",
                padding: "var(--global-dimension-size-50)",
              }}
            />
          </TriggerWrap>
          <Tooltip>{colorKey}</Tooltip>
        </TooltipTrigger>
      ))}
    </Flex>
  );
}

/** The grayscale categorical palette. Hover a swatch for its key. */
export const CategoricalGrayscale: Story = {
  parameters: { controls: { disable: true } },
  render: () => <GrayscaleCategoricalChartColors />,
};

function SemanticChartColors() {
  const colors = useSemanticChartColors();
  return (
    <Flex direction="column" gap="size-100">
      {SEMANTIC_CHART_COLORS.map((colorKey) => (
        <TooltipTrigger key={colorKey} delay={0}>
          <TriggerWrap>
            <div
              style={{
                backgroundColor: colors[colorKey],
                height: "40px",
                width: "40px",
                padding: "var(--global-dimension-size-50)",
              }}
            />
          </TriggerWrap>
          <Tooltip>{colorKey}</Tooltip>
        </TooltipTrigger>
      ))}
    </Flex>
  );
}

/** The semantic palette. Hover a swatch for its key. */
export const Semantic: Story = {
  parameters: { controls: { disable: true } },
  render: () => <SemanticChartColors />,
};

const THUMBNAIL_RAMPS = [
  "blue",
  "orange",
  "purple",
  "magenta",
  "red",
  "gray",
] as const;

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: function PalettesThumbnail() {
    const colors = useSequentialChartColors();
    const entries = Object.entries(colors).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--global-dimension-size-75)",
          width: "100%",
        }}
      >
        {THUMBNAIL_RAMPS.map((ramp) => (
          <div key={ramp} style={{ display: "flex", height: "20px" }}>
            {entries
              .filter(([name]) => new RegExp(`^${ramp}\\d+$`).test(name))
              .map(([name, color]) => (
                <div key={name} style={{ flex: 1, backgroundColor: color }} />
              ))}
          </div>
        ))}
      </div>
    );
  },
};
