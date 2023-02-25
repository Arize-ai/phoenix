import React from "react";
import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { ColoringStrategy } from "./types";

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
