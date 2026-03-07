import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

const bannerCSS = css`
  background-color: var(--ac-global-color-warning-100);
  border: 1px solid var(--ac-global-color-warning-400);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-static-size-150)
    var(--global-dimension-static-size-200);
`;

export function SandboxMismatchBanner() {
  return (
    <div css={bannerCSS}>
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.AlertTriangleOutline />} color="warning" />
        <Text size="S" color="warning">
          The sandbox environment has changed since this evaluator was created.
          Re-save the evaluator to update its environment snapshot.
        </Text>
      </Flex>
    </div>
  );
}

export function SandboxMismatchIcon() {
  return (
    <Icon
      svg={<Icons.AlertTriangleOutline />}
      color="warning"
      aria-label="Sandbox environment mismatch"
    />
  );
}
