import { forwardRef } from "react";
import {
  Group as AriaGroup,
  GroupProps as AriaGroupProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { ComponentSize } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts";

/**
 * A forwardRef wrapper around react-aria-components Group.
 *
 * Usage:
 * ```tsx
 * <Group ref={myRef} ...props />
 * ```
 */

const groupCSS = css`
  display: flex;
  align-items: center;
  gap: 0;

  & > button:not(:first-of-type):not(:last-of-type) {
    border-radius: 0;
    border-right: none;
  }
  & > button:first-of-type {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: none;
  }
  & > button:last-of-type {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

type GroupProps = AriaGroupProps & {
  size?: ComponentSize;
};

export const Group = forwardRef<HTMLDivElement, GroupProps>(
  ({ size, ...props }, ref) => (
    <SizeProvider size={size}>
      <AriaGroup {...props} ref={ref} css={groupCSS} />
    </SizeProvider>
  )
);

Group.displayName = "Group";
