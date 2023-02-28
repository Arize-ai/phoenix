import React from "react";
import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import { usePointCloudStore } from "@phoenix/store";

import { ColoringStrategyPicker } from "./ColoringStrategyPicker";

export function PointCloudDisplaySettings() {
  const [coloringStrategy, setColoringStrategy] = usePointCloudStore(
    (state) => [state.coloringStrategy, state.setColoringStrategy]
  );
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
          onChange={setColoringStrategy}
        />
      </Form>
    </section>
  );
}
