import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Flex, View } from "@phoenix/components";

const versionListItemCSS = css`
  border-bottom: 1px solid var(--global-color-gray-300);
  transition: background-color 0.1s ease-in;

  &[data-active="true"],
  &:hover {
    background-color: var(--global-color-gray-200);
  }

  & > a {
    text-decoration: none;
    color: inherit;
  }
`;

/**
 * A row of a versions list that links to the version's page.
 */
export function VersionListItem({
  to,
  active,
  children,
}: {
  to: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div css={versionListItemCSS} data-active={active}>
      <Link to={to}>
        <View width="100%" paddingY="size-100" paddingX="size-200">
          {children}
        </View>
      </Link>
    </div>
  );
}

export const VERSIONS_LIST_WIDTH = 400;

const versionsListScrollCSS = css`
  height: 100%;
  overflow: auto;
`;

/**
 * The full-height, independently scrolling column that holds a versions
 * list, beside the selected version's details.
 */
export function VersionsListContainer({
  onScroll,
  children,
}: {
  onScroll?: (scrollContainer: HTMLDivElement) => void;
  children: ReactNode;
}) {
  return (
    <View
      height="100%"
      width={VERSIONS_LIST_WIDTH}
      minWidth={VERSIONS_LIST_WIDTH}
      borderRightWidth="thin"
      borderColor="gray-300"
    >
      <div
        css={versionsListScrollCSS}
        onScroll={(event) => onScroll?.(event.currentTarget)}
      >
        <Flex direction="column">{children}</Flex>
      </div>
    </View>
  );
}
