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
  gap: var(--ac-global-dimension-size-100);
`;

type GroupProps = AriaGroupProps & {
  size?: ComponentSize;
};

export const Group = forwardRef<HTMLDivElement, GroupProps>(
  ({ size, ...props }, ref) => (
    <SizeProvider size={size}>
      <AriaGroup
        {...props}
        ref={ref}
        css={groupCSS}
        className="ac-group react-aria-Group"
      />
    </SizeProvider>
  )
);

Group.displayName = "Group";
