import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useResolvedPath } from "react-router";

import { Flex, Link } from "@phoenix/components";

const NUM_VERSIONS_TO_SHOW = 5;

const versionListItemCSS = css`
  padding-bottom: var(--global-dimension-size-200);
  position: relative;
`;

const versionsConnectorCSS = css`
  position: absolute;
  top: 25px;
  left: 11px;
  height: calc(100% - 32px);
  width: 2px;
  --connector-color: var(--global-color-gray-400);
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0 4px,
      var(--global-color-gray-50) 4px 8px
    ),
    var(--connector-color);
  background-size: 4px 100%;
  background-position: 80%;
  background-repeat: no-repeat;
  &[data-last="true"] {
    background:
      repeating-linear-gradient(
        to bottom,
        transparent 0 4px,
        var(--global-color-gray-50) 4px 8px
      ),
      linear-gradient(to bottom, var(--connector-color), transparent);
  }
`;

export type LatestVersionsTimelineItem = {
  id: string;
  sequenceNumber: number;
  /**
   * The rendered summary of the version
   */
  summary: ReactNode;
};

/**
 * The most recent versions of a prompt or decision, newest first, joined by
 * a dashed connector, with a link to the full version list.
 */
export function LatestVersionsTimeline({
  items,
}: {
  items: readonly LatestVersionsTimelineItem[];
}) {
  const basePath = useResolvedPath(".").pathname;
  return (
    <div>
      <ul>
        {items.map((item, index) => {
          const isLastConnector = index === NUM_VERSIONS_TO_SHOW - 1;
          return (
            <li key={item.id} css={versionListItemCSS}>
              {item.summary}
              {item.sequenceNumber !== 1 ? (
                <VersionsConnector isLastConnector={isLastConnector} />
              ) : null}
            </li>
          );
        })}
      </ul>
      <Flex direction="row" justifyContent="end">
        <Link to={`${basePath}/versions`}>View all versions</Link>
      </Flex>
    </div>
  );
}

function VersionsConnector({ isLastConnector }: { isLastConnector?: boolean }) {
  return <div css={versionsConnectorCSS} data-last={isLastConnector} />;
}
