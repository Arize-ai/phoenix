import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";

import { PxiHoverReveal, SolveWithPxiButton } from "../SolveWithPxi";
import type { PxiScenario } from "./types";

const fieldRowCSS = css`
  justify-content: space-between;
  padding: var(--global-dimension-static-size-100)
    var(--global-dimension-static-size-150);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default, var(--global-color-gray-300));
  &:first-of-type {
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default, var(--global-color-gray-300));
  }
`;

const scenario: PxiScenario = {
  title: "Hover reveal — field rows (hover or tab to reveal)",
  Component: function HoverReveal() {
    return (
      <div>
        <PxiHoverReveal
          css={fieldRowCSS}
          reveal={
            <SolveWithPxiButton
              variant="quiet"
              size="S"
              label="Explain with PXI"
            />
          }
        >
          <Flex direction="column" gap="size-25">
            <Text size="XS" color="text-500">
              Output
            </Text>
            <Text size="S">The capital of France is Berlin.</Text>
          </Flex>
        </PxiHoverReveal>
        <PxiHoverReveal
          css={fieldRowCSS}
          reveal={
            <SolveWithPxiButton
              variant="quiet"
              size="S"
              label="Explain with PXI"
            />
          }
        >
          <Flex direction="column" gap="size-25">
            <Text size="XS" color="text-500">
              Exception
            </Text>
            <Text size="S">RateLimitError: 429 Too Many Requests</Text>
          </Flex>
        </PxiHoverReveal>
      </div>
    );
  },
};

export default scenario;
