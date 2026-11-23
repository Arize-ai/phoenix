import { css } from "@emotion/react";

import { ColorSwatch, Text, truncateSingleCSS } from "@phoenix/components";
import { BaselineExperimentBadge } from "@phoenix/components/experiment/BaselineExperimentBadge";

const experimentNameWithColorSwatchCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  max-width: 100%;
  /* Keep the swatch and badge on the name's line; only the name shrinks */
  & > * {
    flex: none;
  }
  .experiment-name-with-color-swatch__name {
    flex: 0 1 auto;
    min-width: 0;
    ${truncateSingleCSS}
  }
`;

/**
 * An experiment's name on one line, led by its color swatch. The name
 * truncates with an ellipsis when space runs out.
 */
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
    <div css={experimentNameWithColorSwatchCSS}>
      <ColorSwatch color={color} shape="circle" />
      <Text
        className="experiment-name-with-color-swatch__name"
        weight="heavy"
        title={name}
        size="S"
      >
        {name}
      </Text>
      {isBaseline ? <BaselineExperimentBadge /> : null}
    </div>
  );
}
