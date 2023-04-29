import React from "react";
import { useLoaderData, useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Dialog, DialogContainer, Heading, View } from "@arizeai/components";

import { dimensionLoaderQuery$data } from "./__generated__/dimensionLoaderQuery.graphql";

export function Dimension() {
  const data = useLoaderData() as dimensionLoaderQuery$data;
  const navigate = useNavigate();
  return (
    <DialogContainer
      type="slideOver"
      isDismissable
      onDismiss={() => navigate("/")}
    >
      <Dialog size="L" title={data.dimension.name}>
        <main
          css={css`
            padding: var(--px-spacing-med);
          `}
        >
          <View
            borderColor="dark"
            borderRadius="medium"
            padding="static-size-200"
          >
            <Heading>Drift</Heading>
          </View>
        </main>
      </Dialog>
    </DialogContainer>
  );
}
