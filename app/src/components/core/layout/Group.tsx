import { css } from "@emotion/react";
import { forwardRef } from "react";
import type { GroupProps as AriaGroupProps } from "react-aria-components";
import { Group as AriaGroup } from "react-aria-components";

import { SizeProvider } from "@phoenix/components/core/contexts/SizeContext";
import type { ComponentSize } from "@phoenix/components/core/types";

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
  gap: var(--global-dimension-size-100);
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
        className="group react-aria-Group"
      />
    </SizeProvider>
  )
);

Group.displayName = "Group";
