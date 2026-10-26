import { useState } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Flex,
  Icon,
  Icons,
  LinkButton,
  Switch,
  TitleWithID,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { VersionMetadataCard } from "@phoenix/pages/prompt/VersionMetadataCard";

import type { DecisionVersionDetailsPage__main$key } from "./__generated__/DecisionVersionDetailsPage__main.graphql";
import { DecisionCodeExportCard } from "./DecisionCodeExportCard";
import { DecisionDefinitionCard } from "./DecisionDefinitionCard";
import { DecisionModelConfigurationCard } from "./DecisionModelConfigurationCard";
import { DecisionVersionDiffView } from "./DecisionVersionDiffView";
import { DecisionVersionTagsList } from "./DecisionVersionTagsList";
import { TagDecisionVersionButton } from "./TagDecisionVersionButton";

/**
 * A single decision version: its definition (with a diff against the
 * previous version), model, metadata, and how to run it.
 */
export function DecisionVersionDetailsPage({
  decisionVersion,
}: {
  decisionVersion: DecisionVersionDetailsPage__main$key;
}) {
  const version = useFragment<DecisionVersionDetailsPage__main$key>(
    graphql`
      fragment DecisionVersionDetailsPage__main on DecisionVersion {
        id
        metadata
        decision {
          id
          versionTags {
            id
            name
          }
        }
        ...DecisionVersionTagsList_data
        ...DecisionDefinitionCard_version
        ...DecisionModelConfigurationCard_version
        ...DecisionCodeExportCard_version
        previousVersion {
          ...DecisionDefinitionCard_version
        }
      }
    `,
    decisionVersion
  );
  const [showDiff, setShowDiff] = useState(false);
  const previousVersion = version.previousVersion;
  const hasPreviousVersion = previousVersion != null;
  const decisionId = version.decision.id;
  return (
    <View width="100%" overflow="auto" elementType="section">
      <View padding="size-200" width="100%" overflow="auto">
        <Flex
          direction="column"
          gap="size-200"
          maxWidth={900}
          marginStart="auto"
          marginEnd="auto"
        >
          <Flex direction="row" justifyContent="space-between">
            <Flex direction="row" gap="size-100" alignItems="center">
              <TitleWithID title="Version" id={version.id} />
              <DecisionVersionTagsList decisionVersion={version} />
            </Flex>
            <Flex direction="row" gap="size-100">
              <TagDecisionVersionButton
                versionId={version.id}
                tagNames={version.decision.versionTags.map((tag) => tag.name)}
              />
              <TooltipTrigger delay={0}>
                <TriggerWrap>
                  <LinkButton
                    variant="primary"
                    leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
                    to={`/playground?${new URLSearchParams({ decisionId, decisionVersionId: version.id })}`}
                    size="S"
                    aria-label="Open this Decision version in Playground"
                  >
                    Playground
                  </LinkButton>
                </TriggerWrap>
                <Tooltip>
                  <TooltipArrow />
                  Open this Decision version in Playground
                </Tooltip>
              </TooltipTrigger>
            </Flex>
          </Flex>
          <DecisionDefinitionCard
            decisionVersion={version}
            extra={
              <Switch
                labelPlacement="start"
                isSelected={showDiff}
                isDisabled={!hasPreviousVersion}
                onChange={setShowDiff}
              >
                Diff
              </Switch>
            }
          >
            {showDiff && previousVersion ? (
              <DecisionVersionDiffView
                current={version}
                previous={previousVersion}
              />
            ) : undefined}
          </DecisionDefinitionCard>
          <DecisionModelConfigurationCard decisionVersion={version} />
          <VersionMetadataCard
            metadata={version.metadata}
            testId="decision-version-metadata-card"
          />
          <DecisionCodeExportCard decisionVersion={version} />
        </Flex>
      </View>
    </View>
  );
}
