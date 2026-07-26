import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { CategoricalQuickCreate } from "@phoenix/components/annotation/CategoricalQuickCreate";
import type { AnnotationConfigCategorical } from "@phoenix/components/annotation/types";

const STACK_SIZES = [2, 3, 4, 5, 7, 8, 12] as const;

function getGradientConfig(itemCount: number): AnnotationConfigCategorical {
  return {
    id: `gradient-${itemCount}`,
    name: `gradient-${itemCount}`,
    annotationType: "CATEGORICAL",
    optimizationDirection: "MAXIMIZE",
    values: Array.from({ length: itemCount }, (_value, itemIndex) => ({
      label: String(itemIndex + 1),
      score: itemIndex / (itemCount - 1),
    })),
  };
}

const gradientStacksCSS = css`
  display: flex;
  align-items: flex-start;
  gap: var(--global-dimension-size-200);
  width: 100%;
  overflow-x: auto;
  padding-bottom: var(--global-dimension-size-100);
`;

const gradientStackCSS = css`
  flex: 0 0 220px;
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-popover-border-color);
  border-radius: var(--global-rounding-small);
  background: var(--global-popover-background-color);
`;

const meta = {
  title: "Detail panel/Categorical quick create",
  component: CategoricalQuickCreate,
  parameters: {
    inset: true,
    width: "fill",
    themeLayout: "column",
  },
  args: {
    annotationName: "gradient",
    config: getGradientConfig(5),
    onCreate: () => Promise.resolve(),
  },
} satisfies Meta<typeof CategoricalQuickCreate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScoreGradients: Story = {
  render: () => (
    <div css={gradientStacksCSS}>
      {STACK_SIZES.map((itemCount) => {
        const config = getGradientConfig(itemCount);
        return (
          <div key={itemCount} css={gradientStackCSS}>
            <CategoricalQuickCreate
              annotationName={config.name}
              config={config}
              onCreate={() => Promise.resolve()}
            />
          </div>
        );
      })}
    </div>
  ),
};
