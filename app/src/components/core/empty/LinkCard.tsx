import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components/core/content";
import { Flex } from "@phoenix/components/core/layout";

const linkCardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  padding: var(--global-dimension-size-200);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--global-border-color-default);
  background-color: transparent;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--global-color-gray-400);
  }
`;

const descriptionCSS = css`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export type LinkCardProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  href: string;
  external?: boolean;
};

export function LinkCard({
  icon,
  title,
  description,
  href,
  external,
}: LinkCardProps) {
  return (
    <a
      href={href}
      css={linkCardCSS}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined)}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        {icon}
        <Text weight="heavy">{title}</Text>
      </Flex>
      <Text size="S" color="text-700" css={descriptionCSS}>
        {description}
      </Text>
    </a>
  );
}
