import { css } from "@emotion/react";

import { SwatchedName, Text } from "@phoenix/components";
import { BaselineExperimentBadge } from "@phoenix/components/experiment/BaselineExperimentBadge";

const experimentNameWithColorSwatchCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  max-width: 100%;
  /* Only the name shrinks; the baseline badge keeps its width */
  .experiment-name-with-color-swatch__name {
    display: flex;
    min-width: 0;
  }
  & > .badge {
    flex: none;
  }
`;

/**
 * An experiment's name on one line, led by the swatch that keys it to its
 * series in the comparison, and marked when it is the baseline.
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
      <Text
        className="experiment-name-with-color-swatch__name"
        weight="heavy"
        size="S"
      >
        <SwatchedName name={name} color={color} />
      </Text>
      {isBaseline ? <BaselineExperimentBadge /> : null}
    </div>
  );
}
