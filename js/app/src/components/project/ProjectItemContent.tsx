import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";

import { GradientCircle } from "./GradientCircle";

const projectNameCSS = css`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export interface ProjectItemContentProps {
  name: string;
  gradientStartColor: string;
  gradientEndColor: string;
}

/**
 * The content of a menu or list item representing a project: the project's
 * color gradient followed by its name. Long names truncate with an ellipsis
 * instead of stretching the containing menu.
 */
export function ProjectItemContent({
  name,
  gradientStartColor,
  gradientEndColor,
}: ProjectItemContentProps) {
  return (
    <Flex
      direction="row"
      alignItems="center"
      gap="var(--global-menu-item-content-gap)"
      minWidth={0}
    >
      <GradientCircle
        gradientStartColor={gradientStartColor}
        gradientEndColor={gradientEndColor}
        size={12}
      />
      <span css={projectNameCSS}>{name}</span>
    </Flex>
  );
}
