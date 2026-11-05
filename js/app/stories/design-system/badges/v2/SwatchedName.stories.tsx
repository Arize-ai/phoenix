import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Text } from "@phoenix/components";
import { SwatchedName } from "@phoenix/components/core/v2";
import { useExperimentColors } from "@phoenix/components/experiment";
import { useWordColor } from "@phoenix/hooks/useWordColor";

import { OptionGrid } from "../../../utils/OptionGrid";

/**
 * A name led by the swatch that keys it to its other appearances on the
 * page, such as an experiment beside its series in a comparison chart. The
 * color identifies and judges nothing.
 *
 * - **Series position**: assigned by order, as experiments in a comparison
 *   are. The color means something only beside the others it tells apart.
 * - **Picked by a person**: a dataset or prompt label's color.
 * - **Derived from the name**: an annotation name's color, the same
 *   wherever that name appears.
 *
 * A status is a `Status Indicator`, even when drawn as a dot, and a value
 * from a closed set of kinds is a `Badge`. The name takes its type from its
 * context.
 */
const meta: Meta = {
  title: "Design System/Badges/V2/Swatched Name",
  component: SwatchedName,
  tags: ["updated", "unreviewed", "complete", "unused"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const EXPERIMENTS = [
  "Baseline prompt",
  "Shorter system prompt",
  "Few-shot examples",
];

const LENGTHS: { label: string; name: string }[] = [
  { label: "Empty", name: "" },
  { label: "Regular", name: "Few-shot examples" },
  {
    label: "Long",
    name: "Few-shot examples with retrieved context and a stricter output schema",
  },
];

const stackCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const constrainedCSS = css`
  width: 160px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

export const Default: StoryFn = () => {
  const { getExperimentColor } = useExperimentColors();
  return (
    <SwatchedName color={getExperimentColor(0)} name="Few-shot examples" />
  );
};
Default.tags = ["!dev"];

export const ColorSources: StoryFn = () => {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const annotationColor = useWordColor("Correctness");
  const sources: { label: string; names: { name: string; color: string }[] }[] =
    [
      {
        label: "Series position",
        names: EXPERIMENTS.map((name, index) => ({
          name,
          color:
            index === 0 ? baseExperimentColor : getExperimentColor(index - 1),
        })),
      },
      {
        label: "Picked by a person",
        names: [{ name: "Needs review", color: "#33c5e8" }],
      },
      {
        label: "Derived from the name",
        names: [{ name: "Correctness", color: annotationColor }],
      },
    ];
  return (
    <OptionGrid
      rows={sources}
      renderCell={(source) => (
        <div css={stackCSS}>
          {source.names.map(({ name, color }) => (
            <SwatchedName key={name} color={color} name={name} />
          ))}
        </div>
      )}
    />
  );
};
ColorSources.storyName = "Color Sources";
ColorSources.tags = ["!dev"];
ColorSources.parameters = { themeLayout: "row" };

export const Context: StoryFn = () => {
  const { getExperimentColor } = useExperimentColors();
  return (
    <OptionGrid
      rows={[{ label: "Experiment header" }, { label: "Body text" }]}
      renderCell={(row) =>
        row.label === "Experiment header" ? (
          <Text size="S" weight="heavy">
            <SwatchedName
              color={getExperimentColor(0)}
              name="Few-shot examples"
            />
          </Text>
        ) : (
          <Text size="XS">
            <SwatchedName
              color={getExperimentColor(0)}
              name="Few-shot examples"
            />
          </Text>
        )
      }
    />
  );
};
Context.tags = ["!dev"];
Context.parameters = { themeLayout: "row" };

export const ContentLength: StoryFn = () => {
  const { getExperimentColor } = useExperimentColors();
  return (
    <OptionGrid
      rows={LENGTHS}
      renderCell={(length) => (
        <div css={constrainedCSS}>
          <SwatchedName color={getExperimentColor(0)} name={length.name} />
        </div>
      )}
    />
  );
};
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "row" };

function ThumbnailNames() {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  return (
    <div css={stackCSS}>
      {EXPERIMENTS.map((name, index) => (
        <SwatchedName
          key={name}
          name={name}
          color={
            index === 0 ? baseExperimentColor : getExperimentColor(index - 1)
          }
        />
      ))}
    </div>
  );
}

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => <ThumbnailNames />,
};
