import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import type { SliderProps } from "@phoenix/components";
import { Slider, SliderNumberField, View } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A slider picks a number from a bounded range. The output beside its label
 * shows the value: plain text by default, or a `SliderNumberField` when the
 * value should also be typed.
 *
 * `isDisabled` and `orientation="vertical"` are accepted but have no styling
 * yet: a disabled slider looks enabled, and a vertical one has no track line
 * and no height, so its thumbs have no length to travel. The grid below
 * gives the vertical slider the horizontal one's length so its thumbs show.
 */
const meta: Meta = {
  title: "Design System/Forms/Slider",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Slider,
  subcomponents: { SliderNumberField },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const SLIDER_WIDTH = "240px";

export const Default: StoryFn = () => (
  <View width={SLIDER_WIDTH}>
    <Slider label="Temperature" defaultValue={0.7} maxValue={2} step={0.1} />
  </View>
);
Default.tags = ["!dev"];

const OUTPUTS: { label: string; output?: ReactNode }[] = [
  { label: "Text (default)" },
  { label: "Number field", output: <SliderNumberField /> },
];

const LABELING: {
  label: string;
  props: Partial<SliderProps<number | number[]>>;
}[] = [
  { label: "Label", props: {} },
  { label: "No label", props: { label: undefined, "aria-label": "Top P" } },
];

const STATES: {
  label: string;
  props: Partial<SliderProps<number | number[]>>;
}[] = [
  { label: "Default", props: {} },
  { label: "Disabled", props: { isDisabled: true } },
];

export const OutputsLabelsAndStates: StoryFn = () => (
  <OptionGrid
    rows={OUTPUTS.flatMap((output) =>
      LABELING.map((labeling) => ({
        label: `${output.label} · ${labeling.label}`,
        output: output.output,
        props: labeling.props,
      }))
    )}
    columns={STATES}
    cellWidth={SLIDER_WIDTH}
    renderCell={(row, state) => (
      <Slider
        label="Top P"
        defaultValue={0.9}
        maxValue={1}
        step={0.01}
        {...row.props}
        {...state?.props}
      >
        {row.output}
      </Slider>
    )}
  />
);
OutputsLabelsAndStates.storyName = "Outputs, Labels and States";
OutputsLabelsAndStates.parameters = { themeLayout: "column" };
OutputsLabelsAndStates.tags = ["!dev"];

const ORIENTATIONS = (["horizontal", "vertical"] as const).map(
  (orientation) => ({ label: orientation, code: true, orientation })
);

const THUMBS: { label: string; defaultValue: number | number[] }[] = [
  { label: "One thumb", defaultValue: 50 },
  { label: "Two thumbs", defaultValue: [25, 75] },
];

const verticalTrackCSS = css`
  .slider__track {
    height: ${SLIDER_WIDTH};
  }
`;

/**
 * An array value gives the slider one thumb per entry, and the track fills
 * between the first two. Name each thumb with `thumbLabels`. A
 * `SliderNumberField` edits only the first thumb, so a range keeps the text
 * output.
 */
export const OrientationsAndThumbs: StoryFn = () => (
  <OptionGrid
    rows={ORIENTATIONS}
    columns={THUMBS}
    cellWidth={SLIDER_WIDTH}
    renderCell={(orientation, thumbs) => (
      <Slider
        label="Range"
        defaultValue={thumbs?.defaultValue}
        maxValue={100}
        thumbLabels={["Start", "End"]}
        orientation={orientation.orientation}
        css={
          orientation.orientation === "vertical" ? verticalTrackCSS : undefined
        }
      />
    )}
  />
);
OrientationsAndThumbs.parameters = { themeLayout: "column" };
OrientationsAndThumbs.tags = ["!dev"];

const USES: { label: string; slider: ReactNode }[] = [
  {
    label: "Whole numbers",
    slider: (
      <Slider label="Repetitions" defaultValue={1} minValue={1} maxValue={30}>
        <SliderNumberField />
      </Slider>
    ),
  },
  {
    label: "Model parameter",
    slider: (
      <Slider label="Temperature" defaultValue={1} maxValue={2} step={0.1}>
        <SliderNumberField defaultValue={1} />
      </Slider>
    ),
  },
];

/**
 * Playground experiments take a whole number of repetitions, and model
 * parameters such as temperature move in tenths with a number field for exact
 * entry.
 */
export const ExampleUsage: StoryFn = () => (
  <OptionGrid
    rows={USES}
    cellWidth={SLIDER_WIDTH}
    renderCell={(use) => use.slider}
  />
);
ExampleUsage.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <View width="100%">
      <Slider label="Temperature" defaultValue={0.7} maxValue={1} step={0.1}>
        <SliderNumberField />
      </Slider>
    </View>
  ),
};
