import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Flex, Link } from "@phoenix/components";

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

function VersionsConnector({ isLastConnector }: { isLastConnector?: boolean }) {
  return <div css={versionsConnectorCSS} data-last={isLastConnector} />;
}

/**
 * The newest few versions as a timeline, with a link to the full list.
 * `versions` run newest first; the first version has no connector below it.
 */
export function LatestVersionsList<
  T extends { id: string; sequenceNumber: number },
>({
  versions,
  renderVersion,
  viewAllTo,
}: {
  versions: ReadonlyArray<T>;
  renderVersion: (version: T) => ReactNode;
  viewAllTo: string;
}) {
  return (
    <div>
      <ul>
        {versions.map((version, index) => (
          <li key={version.id} css={versionListItemCSS}>
            {renderVersion(version)}
            {version.sequenceNumber !== 1 ? (
              <VersionsConnector
                isLastConnector={index === versions.length - 1}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <Flex direction="row" justifyContent="end">
        <Link to={viewAllTo}>View all versions</Link>
      </Flex>
    </div>
  );
}
