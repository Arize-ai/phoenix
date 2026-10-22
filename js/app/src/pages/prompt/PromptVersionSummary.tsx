import { css } from "@emotion/react";
import { formatRelative } from "date-fns/formatRelative";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Flex,
  Text,
  TimelineContent,
  TimelineHeader,
  TimelineItem,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useCurrentTime } from "@phoenix/hooks";

import type {
  PromptVersionSummaryFragment$data,
  PromptVersionSummaryFragment$key,
} from "./__generated__/PromptVersionSummaryFragment.graphql";
import { TagVersionLabel } from "./PromptVersionTagsList";

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
      name
    }
  }
`;

type PromptVersionSummaryProps = {
  promptVersion: PromptVersionSummaryFragment$key;
};

export function PromptVersionSummary(props: PromptVersionSummaryProps) {
  const version = useFragment<PromptVersionSummaryFragment$key>(
    promptVersionSummaryFragment,
    props.promptVersion
  );

  return (
    <Flex direction="column" gap="size-50">
      <PromptVersionSummaryHeader version={version} />
      <PromptVersionSummaryDetails version={version} />
    </Flex>
  );
}

/**
 * A prompt version as an item of a `Timeline`
 */
export function PromptVersionTimelineItem(props: PromptVersionSummaryProps) {
  const version = useFragment<PromptVersionSummaryFragment$key>(
    promptVersionSummaryFragment,
    props.promptVersion
  );

  return (
    <TimelineItem>
      <TimelineHeader>
        <PromptVersionSummaryHeader version={version} />
      </TimelineHeader>
      <TimelineContent>
        <PromptVersionSummaryDetails version={version} />
      </TimelineContent>
    </TimelineItem>
  );
}

type PromptVersionSummaryPartProps = {
  version: PromptVersionSummaryFragment$data;
};

const headerCSS = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--global-dimension-size-50) var(--global-dimension-size-100);
  .prompt-version-summary__heading {
    display: flex;
    gap: var(--global-dimension-size-100);
    white-space: nowrap;
  }
`;

/**
 * The version number, when it was created and its tags, each of which wraps
 * onto a further line when it does not fit
 */
function PromptVersionSummaryHeader({
  version,
}: PromptVersionSummaryPartProps) {
  const { nowEpochMs } = useCurrentTime();
  return (
    <div css={headerCSS}>
      <span className="prompt-version-summary__heading">
        <Text fontFamily="mono">{`v${version.sequenceNumber}`}</Text>
        <Text color="text-700">
          {formatRelative(version.createdAt, nowEpochMs)}
        </Text>
      </span>
      {version.tags.map((tag) => (
        <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
      ))}
    </div>
  );
}

const idLineCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  .prompt-version-summary__id {
    flex: 1 1 auto;
    min-width: 0;
  }
`;

/**
 * The version's ID and author, then its description when it has one
 */
function PromptVersionSummaryDetails({
  version,
}: PromptVersionSummaryPartProps) {
  return (
    <Flex direction="column" gap="size-50">
      <div css={idLineCSS}>
        <span className="prompt-version-summary__id">
          <Truncate maxWidth="100%" title={version.id}>
            <Text color="text-500" size="XS">
              {version.id}
            </Text>
          </Truncate>
        </span>
        {version.user && (
          <Flex direction="row" gap="size-50" alignItems="center" flex="none">
            <UserPicture
              size={14}
              name={version.user.username}
              profilePictureUrl={version.user.profilePictureUrl}
            />
            <Text size="XS">{version.user.username}</Text>
          </Flex>
        )}
      </div>
      {version.description ? (
        <div data-testid="prompt-version-item-description">
          <Truncate maxWidth="100%" title={version.description}>
            <Text color="text-700" size="XS">
              {version.description}
            </Text>
          </Truncate>
        </div>
      ) : null}
    </Flex>
  );
}
