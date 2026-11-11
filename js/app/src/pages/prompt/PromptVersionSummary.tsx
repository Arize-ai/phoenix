import { css } from "@emotion/react";
import { formatRelative } from "date-fns/formatRelative";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Text, TimelineItem } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useCurrentTime } from "@phoenix/hooks";

import type {
  PromptVersionSummaryFragment$data,
  PromptVersionSummaryFragment$key,
} from "./__generated__/PromptVersionSummaryFragment.graphql";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

const promptVersionSummaryFragment = graphql`
  fragment PromptVersionSummaryFragment on PromptVersion {
    id
    description
    sequenceNumber
    createdAt
    user {
      id
      username
      profilePictureUrl
    }
    tags {
      id
    }
    ...PromptVersionTagsList_data
  }
`;

/**
 * The version number, its ID and when it was created on one line. The ID
 * takes the remaining space and is the first to truncate.
 */
const headerCSS = css`
  display: flex;
  align-items: baseline;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  white-space: nowrap;
  .prompt-version-summary__id {
    flex: 1 1 0;
    min-width: 0;
    color: var(--global-text-color-500);
  }
`;

type PromptVersionTimelineItemProps = {
  promptVersion: PromptVersionSummaryFragment$key;
  /**
   * The version's page
   */
  to: string;
  isCurrent?: boolean;
};

/**
 * A prompt version as an item of a `Timeline`, linking to the version's page
 */
export function PromptVersionTimelineItem({
  promptVersion,
  to,
  isCurrent,
}: PromptVersionTimelineItemProps) {
  const version = useFragment<PromptVersionSummaryFragment$key>(
    promptVersionSummaryFragment,
    promptVersion
  );

  const { nowEpochMs } = useCurrentTime();

  return (
    <TimelineItem to={to} isCurrent={isCurrent}>
      <div css={headerCSS}>
        <Text fontFamily="mono" size="XS">
          {`v${version.sequenceNumber}`}
        </Text>
        {/* The ID's color sits on its truncating wrapper so the ellipsis matches the text */}
        <span className="prompt-version-summary__id">
          <Truncate maxWidth="100%" title={version.id}>
            <Text color="inherit" size="XS">
              {version.id}
            </Text>
          </Truncate>
        </span>
        <Text color="text-700" size="XS">
          {formatRelative(version.createdAt, nowEpochMs)}
        </Text>
      </div>
      <PromptVersionSummaryDetails version={version} />
    </TimelineItem>
  );
}

/**
 * The version's description, its tags and then its author, each on its own
 * line when present
 */
function PromptVersionSummaryDetails({
  version,
}: {
  version: PromptVersionSummaryFragment$data;
}) {
  if (!version.description && !version.user && version.tags.length === 0) {
    return null;
  }
  return (
    <Flex direction="column" gap="size-50">
      {version.description ? (
        <div data-testid="prompt-version-item-description">
          <Truncate maxWidth="100%" title={version.description}>
            <Text color="text-700" size="XS">
              {version.description}
            </Text>
          </Truncate>
        </div>
      ) : null}
      <PromptVersionTagsList promptVersion={version} />
      {version.user && (
        <Flex direction="row" gap="size-50" alignItems="center">
          <UserPicture
            size={14}
            name={version.user.username}
            profilePictureUrl={version.user.profilePictureUrl}
          />
          <Text size="XS">{version.user.username}</Text>
        </Flex>
      )}
    </Flex>
  );
}
