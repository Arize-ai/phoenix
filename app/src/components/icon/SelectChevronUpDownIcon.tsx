import { css } from "@emotion/react";

import { Icon } from "./Icon";
import { ChevronUpDown } from "./Icons";

export const SelectChevronUpDownIcon = () => {
  return (
    <Icon
      svg={<ChevronUpDown />}
      css={css`
        font-size: 0.8rem;
      `}
    />
  );
};
