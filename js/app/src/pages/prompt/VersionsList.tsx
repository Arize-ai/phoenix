import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Link, useResolvedPath } from "react-router";

import { Flex, View } from "@phoenix/components";

const versionItemCSS = css`
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

const VERSIONS_LIST_WIDTH = 400;

/**
 * A single version row. Clicking it navigates to /:versionId under the
 * route that renders the list.
 */
export function VersionItem({
  versionId,
  active,
  children,
}: {
  versionId: string;
  active?: boolean;
  children: ReactNode;
}) {
  const basePath = useResolvedPath(".").pathname;
  return (
    <div css={versionItemCSS} data-active={active}>
      <Link to={`${basePath}/${versionId}`}>
        <View width="100%" paddingY="size-100" paddingX="size-200">
          {children}
        </View>
      </Link>
    </div>
  );
}

/**
 * Full height, scrollable column of version rows
 */
export function VersionsList({ children }: { children: ReactNode }) {
  return (
    <View
      height="100%"
      overflow="auto"
      width={VERSIONS_LIST_WIDTH}
      minWidth={VERSIONS_LIST_WIDTH}
      borderRightWidth="thin"
      borderColor="gray-300"
    >
      <Flex direction="column">{children}</Flex>
    </View>
  );
}
