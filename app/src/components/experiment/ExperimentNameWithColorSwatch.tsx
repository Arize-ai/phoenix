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
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        `}
        weight="heavy"
        title={name}
        size="S"
      >
        {name}
      </Text>
    </Flex>
  );
}
