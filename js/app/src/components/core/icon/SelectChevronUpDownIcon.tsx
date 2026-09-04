import { css } from "@emotion/react";

import { Icon } from "./Icon";
import { ChevronUpDownSmall } from "./Icons";

export const SelectChevronUpDownIcon = () => {
  return (
    <Icon
      svg={<ChevronUpDownSmall />}
      css={css`
        font-size: 0.8rem;
      `}
    />
  );
};
