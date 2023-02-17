import { Form } from "@arizeai/components";
import React from "react";
import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { ColoringStrategy } from "./types";
import { css } from "@emotion/react";

type PointCloudDisplaySettingsProps = {
  coloringStrategy: ColoringStrategy;
  onColoringStrategyChange: (strategy: ColoringStrategy) => void;
};
export function PointCloudDisplaySettings(
  props: PointCloudDisplaySettingsProps
) {
  const { coloringStrategy, onColoringStrategyChange } = props;
  return (
    <section
      css={(theme) =>
        css`
          padding: ${theme.spacing.padding8}px;
        `
      }
    >
      <Form>
        <ColoringStrategyPicker
          strategy={coloringStrategy}
          onChange={onColoringStrategyChange}
        />
      </Form>
    </section>
  );
}
