import React from "react";
import { css } from "@emotion/react";

import { Icon } from "../icon/Icon";
import { ChevronUpDownIcon } from "../icon/Icons";

export const SelectChevronUpDownIcon = () => {
  return (
    <Icon
      svg={<ChevronUpDownIcon />}
      css={css`
        font-size: 0.8rem;
      `}
    />
  );
};
