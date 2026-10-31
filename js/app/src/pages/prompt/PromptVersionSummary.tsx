import { css } from "@emotion/react";
import { formatRelative } from "date-fns/formatRelative";
import { useFragment } from "react-relay";
import { Link as RouterLink } from "react-router";
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

  return (
    <TimelineItem to={to} isCurrent={isCurrent}>
      <TimelineHeader>
        <PromptVersionSummaryHeader version={version} />
      </TimelineHeader>
      <TimelineContent>
        <PromptVersionSummaryDetails version={version} />
      </TimelineContent>
    </TimelineItem>
  );
}

/**
 * A prompt version's summary outside of a `Timeline`, such as in a menu item
 */
export function PromptVersionSummary({
  promptVersion,
  to,
  showTags = true,
}: {
  promptVersion: PromptVersionSummaryFragment$key;
  /**
   * The version's page, which its number and ID then link to
   */
  to?: string;
  /**
   * Whether to list the version's tags, which a surface already organized by
   * tag would repeat
   * @default true
   */
  showTags?: boolean;
}) {
  const version = useFragment<PromptVersionSummaryFragment$key>(
    promptVersionSummaryFragment,
    promptVersion
  );
  return (
    <Flex direction="column" gap="size-50" minWidth={0}>
      <PromptVersionSummaryHeader version={version} to={to} />
      <PromptVersionSummaryDetails version={version} showTags={showTags} />
    </Flex>
  );
}

type PromptVersionSummaryPartProps = {
  version: PromptVersionSummaryFragment$data;
};

type PromptVersionSummaryHeaderProps = PromptVersionSummaryPartProps & {
  to?: string;
};

type PromptVersionSummaryDetailsProps = PromptVersionSummaryPartProps & {
  showTags?: boolean;
};

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
  .prompt-version-summary__link {
    display: flex;
    align-items: baseline;
    gap: var(--global-dimension-size-100);
    flex: 1 1 0;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    border-radius: var(--global-rounding-small);
    &:hover .prompt-version-summary__id {
      color: var(--global-text-color-900);
    }
    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }
  }
`;

/**
 * The version number, its ID, its author and when it was created on one line.
 * The ID takes the remaining space and is the first to truncate.
 */
function PromptVersionSummaryHeader({
  version,
  to,
}: PromptVersionSummaryHeaderProps) {
  const { nowEpochMs } = useCurrentTime();
  return (
    <div css={headerCSS}>
      {to ? (
        <RouterLink to={to} className="prompt-version-summary__link">
          <PromptVersionSummaryIdentity version={version} />
        </RouterLink>
      ) : (
        <PromptVersionSummaryIdentity version={version} />
      )}
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
      <Text color="text-700" size="XS">
        {formatRelative(version.createdAt, nowEpochMs)}
      </Text>
    </div>
  );
}

/**
 * The version number and ID. The ID's color sits on its truncating wrapper so
 * the ellipsis matches the text.
 */
function PromptVersionSummaryIdentity({
  version,
}: PromptVersionSummaryPartProps) {
  return (
    <>
      <Text fontFamily="mono" size="XS">
        {`v${version.sequenceNumber}`}
      </Text>
      <span className="prompt-version-summary__id">
        <Truncate maxWidth="100%" title={version.id}>
          <Text color="inherit" size="XS">
            {version.id}
          </Text>
        </Truncate>
      </span>
    </>
  );
}

const tagsCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
  padding-bottom: var(--global-dimension-size-50);
`;

/**
 * The version's description and then its tags, each on its own line when present
 */
function PromptVersionSummaryDetails({
  version,
  showTags = true,
}: PromptVersionSummaryDetailsProps) {
  const tags = showTags ? version.tags : [];
  if (!version.description && tags.length === 0) {
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
      {tags.length > 0 ? (
        <div css={tagsCSS}>
          {tags.map((tag) => (
            <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
          ))}
        </div>
      ) : null}
    </Flex>
  );
}
