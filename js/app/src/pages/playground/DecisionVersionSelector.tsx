import { css } from "@emotion/react";
import { Suspense } from "react";
import { MenuSection } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Flex,
  Loading,
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SelectChevronUpDownIcon,
  Text,
} from "@phoenix/components";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";
import type { PlaygroundInstanceDecision } from "@phoenix/store/playground";

import type { DecisionVersionSelectorVersionsQuery } from "./__generated__/DecisionVersionSelectorVersionsQuery.graphql";
import { IdTruncate } from "./PromptMenu";

/**
 * The version a decision task is on, and a menu to load another by version or
 * by tag, as a prompt task's {@link PromptVersionSelector} does. The versions
 * are fetched when the menu opens.
 */
export function DecisionVersionSelector({
  decision,
  onSelectVersion,
  onSelectTag,
}: {
  decision: PlaygroundInstanceDecision;
  onSelectVersion: (versionId: string) => void;
  onSelectTag: (tagName: string) => void;
}) {
  return (
    <MenuTrigger>
      <Button
        size="S"
        className="right-child"
        aria-label="Decision version"
        css={css`
          justify-content: space-between;
          flex-shrink: 0;
        `}
      >
        {decision.tag ? (
          <TagVersionLabel size="S" maxWidth="10ch">
            {decision.tag}
          </TagVersionLabel>
        ) : (
          <IdTruncate id={decision.versionId} />
        )}
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer placement="bottom start" minHeight={0}>
        <Suspense fallback={<Loading />}>
          <DecisionVersionList
            decisionId={decision.id}
            selectedVersionId={decision.versionId}
            onSelectVersion={onSelectVersion}
            onSelectTag={onSelectTag}
          />
        </Suspense>
      </MenuContainer>
    </MenuTrigger>
  );
}

/** A decision's tags, then its versions, newest first. */
function DecisionVersionList({
  decisionId,
  selectedVersionId,
  onSelectVersion,
  onSelectTag,
}: {
  decisionId: string;
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onSelectTag: (tagName: string) => void;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const data = useLazyLoadQuery<DecisionVersionSelectorVersionsQuery>(
    graphql`
      query DecisionVersionSelectorVersionsQuery($decisionId: ID!) {
        decision: node(id: $decisionId) {
          ... on Decision {
            versionTags {
              name
              decisionVersionId
            }
            versions(first: 100) {
              edges {
                version: node {
                  id
                  description
                  modelName
                  createdAt
                }
              }
            }
          }
        }
      }
    `,
    { decisionId },
    { fetchPolicy: "network-only" }
  );
  const tags = data.decision.versionTags ?? [];
  const versions = (data.decision.versions?.edges ?? []).map(
    (edge) => edge.version
  );

  return (
    <Menu
      aria-label="Decision versions"
      selectionMode="single"
      selectedKeys={[`version:${selectedVersionId}`]}
      onAction={(key) => {
        const [kind, value] = String(key).split(/:(.*)/s);
        if (kind === "tag") onSelectTag(value);
        else onSelectVersion(value);
      }}
    >
      {tags.length > 0 ? (
        <MenuSection>
          <MenuSectionTitle title="Tags" />
          {tags.map((tag) => (
            <MenuItem
              key={tag.name}
              id={`tag:${tag.name}`}
              textValue={tag.name}
            >
              {tag.name}
            </MenuItem>
          ))}
        </MenuSection>
      ) : null}
      <MenuSection>
        <MenuSectionTitle title="Versions" />
        {versions.map((version, index) => {
          const versionTags = tags
            .filter((tag) => tag.decisionVersionId === version.id)
            .map((tag) => tag.name);
          const label = `${index === 0 ? "Latest · " : ""}${fullTimeFormatter(new Date(version.createdAt))}`;

          return (
            <MenuItem
              key={version.id}
              id={`version:${version.id}`}
              textValue={label}
            >
              <Flex direction="column">
                <Text>{label}</Text>
                <Text size="XS" color="text-700">
                  {[version.modelName, ...versionTags, version.description]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Flex>
            </MenuItem>
          );
        })}
      </MenuSection>
    </Menu>
  );
}
