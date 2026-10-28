import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Card,
  CopyToClipboardButton,
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
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { JSONBlock } from "@phoenix/components/code";
import { useTheme } from "@phoenix/contexts";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionVersionDetails_definition$key } from "./__generated__/DecisionVersionDetails_definition.graphql";
import type { DecisionVersionDetails_version$key } from "./__generated__/DecisionVersionDetails_version.graphql";
import { DecisionDefinition } from "./DecisionDefinition";
import { DecisionModelConfigurationCard } from "./DecisionModelConfigurationCard";
import { decisionVersionToText } from "./decisionVersionUtils";
import { TagDecisionVersionButton } from "./TagDecisionVersionButton";

const definitionFragment = graphql`
  fragment DecisionVersionDetails_definition on DecisionVersion {
    inputs {
      name
      description
      # Not rendered: the card lists name and description only, but the
      # copied definition and the version diff carry the whole input.
      jsonSchema
    }
    state {
      __typename
      ... on DecisionObjectState {
        object
      }
      ... on DecisionTextState {
        template
        templateFormat
      }
      ... on DecisionInputState {
        input
      }
    }
    questions {
      __typename
      ... on DecisionPredicateQuestion {
        name
        instructions
        criteria {
          true
          false
        }
      }
      ... on DecisionChoiceQuestion {
        name
        instructions
        choices {
          value
          description
        }
      }
      ... on DecisionScaleQuestion {
        name
        instructions
        levels {
          label
          description
        }
      }
    }
    modelName
    modelProvider
    customProvider {
      id
      name
    }
  }
`;

/**
 * The main column of the decision pages: the definition and model cards for
 * the overview, plus the version header, diff toggle and metadata card for
 * a version's own page.
 */
export function DecisionVersionDetails({
  versionRef,
  decisionId,
  decisionTagNames,
  onRefresh,
  isOverview = false,
}: {
  versionRef: DecisionVersionDetails_version$key;
  decisionId: string;
  decisionTagNames: ReadonlyArray<string>;
  onRefresh: () => void;
  isOverview?: boolean;
}) {
  const version = useFragment(
    graphql`
      fragment DecisionVersionDetails_version on DecisionVersion {
        id
        metadata
        tags {
          id
          name
        }
        ...DecisionVersionDetails_definition
        previousVersion {
          id
          ...DecisionVersionDetails_definition
        }
      }
    `,
    versionRef
  );
  const definition = useFragment<DecisionVersionDetails_definition$key>(
    definitionFragment,
    version
  );
  const previous = useFragment<DecisionVersionDetails_definition$key>(
    definitionFragment,
    version.previousVersion
  );
  const { theme } = useTheme();
  const [showDiff, setShowDiff] = useState(false);
  const definitionText = decisionVersionToText(definition);
  const fileDiff = useMemo(
    () =>
      previous
        ? parseDiffFromFile(
            {
              name: "decision.json",
              contents: decisionVersionToText(previous),
            },
            { name: "decision.json", contents: definitionText }
          )
        : null,
    [previous, definitionText]
  );
  const metadataJSON = JSON.stringify(version.metadata, null, 2);
  return (
    <Flex
      direction="column"
      gap="size-200"
      maxWidth={900}
      marginStart="auto"
      marginEnd="auto"
    >
      {!isOverview ? (
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="row" gap="size-100" alignItems="center">
            <TitleWithID title="Version" id={version.id} />
            <Flex direction="row" gap="size-50" alignItems="center" wrap="wrap">
              {version.tags.map((tag) => (
                <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
              ))}
            </Flex>
          </Flex>
          <Flex direction="row" gap="size-100">
            <CanModify>
              <TagDecisionVersionButton
                versionId={version.id}
                decisionTagNames={decisionTagNames}
                versionTagNames={version.tags.map((tag) => tag.name)}
                onTagSet={onRefresh}
              />
            </CanModify>
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
      ) : null}
      <Card
        title="Decision Definition"
        collapsible
        extra={
          <Flex gap="size-100" alignItems="center">
            {!isOverview ? (
              <Switch
                labelPlacement="start"
                isSelected={showDiff && previous != null}
                isDisabled={!previous}
                onChange={setShowDiff}
              >
                Diff
              </Switch>
            ) : null}
            <CopyToClipboardButton text={definitionText} />
          </Flex>
        }
      >
        {!isOverview && showDiff && fileDiff ? (
          <FileDiff
            fileDiff={fileDiff}
            options={{
              diffStyle: "unified",
              disableFileHeader: true,
              theme: { light: "pierre-light", dark: "pierre-dark" },
              themeType: theme,
            }}
          />
        ) : (
          <DecisionDefinition definition={definition} />
        )}
      </Card>
      <DecisionModelConfigurationCard
        modelName={definition.modelName}
        modelProvider={definition.modelProvider}
        customProviderName={definition.customProvider?.name}
      />
      {!isOverview ? (
        <Card
          title="Metadata"
          collapsible
          extra={<CopyToClipboardButton text={metadataJSON} />}
        >
          <JSONBlock value={metadataJSON} />
        </Card>
      ) : null}
    </Flex>
  );
}
