import { css } from "@emotion/react";

import { ColorSwatch, Flex, Text } from "@phoenix/components";
import { BaselineExperimentBadge } from "@phoenix/components/experiment/BaselineExperimentBadge";

export function ExperimentNameWithColorSwatch({
  name,
  color,
  isBaseline = false,
}: {
  name: string;
  color: string;
  isBaseline?: boolean;
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
      {isBaseline ? <BaselineExperimentBadge /> : null}
    </Flex>
  );
}
