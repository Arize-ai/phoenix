import React from "react";
import { css } from "@emotion/react";

import { Form, TextField } from "@arizeai/components";

export function PointCloudParameterSettings() {
  return (
    <section
      css={css`
        & > .ac-form {
          padding: var(--px-spacing-med) var(--px-spacing-med) 0
            var(--px-spacing-med);
        }
      `}
    >
      <Form>
        <TextField
          label="n components"
          value="3"
          type="number"
          isDisabled
          description="The number of dimensions to display"
        />
        <TextField
          label="min distance"
          value="0"
          type="number"
          isDisabled
          description="UMAP minimum distance hyperparameter"
        />
        <TextField
          label="n neighbors"
          value="30"
          type="number"
          isDisabled
          description="UMAP n neighbors hyperparameter"
        />
        <TextField
          label="n samples"
          value="500"
          type="number"
          isDisabled
          description="UMAP n samples"
        />
      </Form>
    </section>
  );
}
