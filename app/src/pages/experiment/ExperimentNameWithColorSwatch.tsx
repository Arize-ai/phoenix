import { css } from "@emotion/react";

import { ColorSwatch, Flex, Text } from "@phoenix/components";

export function ExperimentNameWithColorSwatch({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <Flex direction="row" gap="size-100" wrap alignItems="center">
      <ColorSwatch color={color} shape="circle" />
      <Text
        css={css`
          white-space: nowrap;
          max-width: var(--ac-global-dimension-size-2000);
          overflow: hidden;
          text-overflow: ellipsis;
        `}
        title={name}
        size="S"
      >
        {name}
      </Text>
    </Flex>
  );
}
