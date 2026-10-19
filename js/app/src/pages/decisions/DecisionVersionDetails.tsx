import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { useSearchParams } from "react-router";

import {
  Card,
  CopyToClipboardButton,
  Flex,
  Heading,
  Icon,
  Icons,
  LinkButton,
  Switch,
  Text,
  TitleWithID,
  View,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { JSONBlock } from "@phoenix/components/code";
import { UserDisplay } from "@phoenix/components/user/UserDisplay";
import { useTheme } from "@phoenix/contexts";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionVersionDetails_definition$key } from "./__generated__/DecisionVersionDetails_definition.graphql";
import type { DecisionVersionDetails_version$key } from "./__generated__/DecisionVersionDetails_version.graphql";
import { SetDecisionTagButton } from "./DecisionActions";
import { decisionVersionToText } from "./decisionVersionUtils";

const definitionFragment = graphql`
  fragment DecisionVersionDetails_definition on DecisionVersion {
    inputs {
      name
      description
      jsonSchema
    }
    state {
      __typename
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

export function DecisionVersionDetails({
  versionRef,
  decisionId,
  tagNames,
  onRefresh,
  isOverview = false,
}: {
  versionRef: DecisionVersionDetails_version$key;
  decisionId: string;
  tagNames: readonly string[];
  onRefresh: () => void;
  isOverview?: boolean;
}) {
  const version = useFragment(
    graphql`
      fragment DecisionVersionDetails_version on DecisionVersion {
        id
        sequenceNumber
        description
        createdAt
        metadata
        schemaVersion
        user {
          username
          profilePictureUrl
        }
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
  const [params, setParams] = useSearchParams();
  const showDiff =
    !isOverview && params.get("diff") === "true" && previous != null;
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
  const inputValues = Object.fromEntries(
    definition.inputs.map((input) => [input.name, `<${input.name}>`])
  );
  const request = JSON.stringify({
    query:
      "mutation RunSavedDecision($id: ID!, $values: JSON!) { runDecisionVersion(input: {decisionVersionId: $id, inputValues: $values}) { result { model answers { name ... on PredicateAnswer { probability } ... on ChoiceAnswer { choice confidence } ... on ScaleAnswer { expectedLevel confidence } } } error } }",
    variables: { id: version.id, values: inputValues },
  });
  const curl = `curl "$PHOENIX_ENDPOINT/graphql" \\\n  -H 'Content-Type: application/json' \\\n  --data '${request.replaceAll("'", "'\\''")}'`;
  return (
    <Flex
      direction="column"
      gap="size-200"
      maxWidth={900}
      marginStart="auto"
      marginEnd="auto"
      width="100%"
    >
      {!isOverview ? (
        <Flex
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
          wrap
        >
          <Flex gap="size-100" alignItems="center">
            <TitleWithID
              title={`Version ${version.sequenceNumber}`}
              id={version.id}
            />
            {version.tags.map((tag) => (
              <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
            ))}
          </Flex>
          <Flex gap="size-100">
            <CanModify>
              <SetDecisionTagButton
                versionId={version.id}
                tagNames={tagNames}
                onSaved={onRefresh}
              />
            </CanModify>
            <LinkButton
              variant="primary"
              size="S"
              leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
              to={`/playground?${new URLSearchParams({ decisionId, decisionVersionId: version.id })}`}
            >
              Playground
            </LinkButton>
          </Flex>
        </Flex>
      ) : null}
      <Card
        title="Decision definition"
        collapsible
        extra={
          <Flex gap="size-100" alignItems="center">
            {!isOverview ? (
              <Switch
                labelPlacement="start"
                isSelected={showDiff}
                isDisabled={!previous}
                onChange={(enabled) =>
                  setParams((search) => {
                    if (enabled) search.set("diff", "true");
                    else search.delete("diff");
                    return search;
                  })
                }
              >
                Diff
              </Switch>
            ) : null}
            <CopyToClipboardButton
              text={definitionText}
              aria-label="Copy decision definition"
            />
          </Flex>
        }
      >
        {showDiff && fileDiff ? (
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
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <section>
                <Heading level={3}>Inputs</Heading>
                {definition.inputs.map((input) => (
                  <View key={input.name} paddingY="size-100">
                    <Text weight="heavy">{input.name}</Text>
                    {input.description ? (
                      <Text>{input.description}</Text>
                    ) : null}
                    {input.jsonSchema ? (
                      <JSONBlock
                        value={JSON.stringify(input.jsonSchema, null, 2)}
                      />
                    ) : null}
                  </View>
                ))}
              </section>
              <section>
                <Heading level={3}>State</Heading>
                {definition.state.__typename === "DecisionTextState" ? (
                  <>
                    <Text color="text-700">
                      {definition.state.templateFormat}
                    </Text>
                    <pre
                      css={css`
                        white-space: pre-wrap;
                        overflow-wrap: anywhere;
                      `}
                    >
                      {definition.state.template}
                    </pre>
                  </>
                ) : definition.state.__typename === "DecisionInputState" ? (
                  <Text>Use input: {definition.state.input}</Text>
                ) : (
                  <Text>Send the declared inputs as a JSON object.</Text>
                )}
              </section>
              <section>
                <Heading level={3}>Questions</Heading>
                <Flex direction="column" gap="size-200">
                  {definition.questions.map((question, index) => {
                    if (question.__typename === "%other") return null;
                    return (
                      <Flex key={index} direction="column" gap="size-100">
                        <Heading level={4}>{question.name}</Heading>
                        <Text>{question.instructions}</Text>
                        {question.__typename === "DecisionPredicateQuestion" ? (
                          <>
                            <Text color="text-700">Predicate</Text>
                            {question.criteria?.true ? (
                              <Text>True: {question.criteria.true}</Text>
                            ) : null}
                            {question.criteria?.false ? (
                              <Text>False: {question.criteria.false}</Text>
                            ) : null}
                          </>
                        ) : question.__typename === "DecisionChoiceQuestion" ? (
                          <ul>
                            {question.choices.map((choice) => (
                              <li key={choice.value}>
                                {choice.value}
                                {choice.description
                                  ? ` — ${choice.description}`
                                  : ""}
                              </li>
                            ))}
                          </ul>
                        ) : question.__typename === "DecisionScaleQuestion" ? (
                          <ol start={0}>
                            {question.levels.map((level, levelIndex) => (
                              <li key={levelIndex}>
                                {level.label}
                                {level.description
                                  ? ` — ${level.description}`
                                  : ""}
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </Flex>
                    );
                  })}
                </Flex>
              </section>
            </Flex>
          </View>
        )}
      </Card>
      <Card title="Model configuration">
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
            <Text>
              Provider:{" "}
              {definition.customProvider?.name ?? definition.modelProvider}
            </Text>
            <Text>Model: {definition.modelName}</Text>
          </Flex>
        </View>
      </Card>
      {!isOverview ? (
        <Card
          title="Version metadata"
          extra={
            <CopyToClipboardButton
              text={JSON.stringify(version.metadata, null, 2)}
            />
          }
        >
          <View padding="size-200">
            <Flex direction="column" gap="size-100">
              <Text>{version.description || "No description"}</Text>
              <Text color="text-700">
                Created {new Date(version.createdAt).toLocaleString()}
              </Text>
              <UserDisplay user={version.user} />
              <JSONBlock value={JSON.stringify(version.metadata, null, 2)} />
            </Flex>
          </View>
        </Card>
      ) : null}
      <Card
        title="Run this version"
        extra={
          <CopyToClipboardButton
            text={curl}
            aria-label="Copy decision request"
          />
        }
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
            <Text>
              Set PHOENIX_ENDPOINT to your Phoenix URL and replace the input
              placeholders. The server uses the saved version’s connection and
              configured credentials.
            </Text>
            <pre
              css={css`
                white-space: pre-wrap;
                overflow-wrap: anywhere;
              `}
            >
              {curl}
            </pre>
          </Flex>
        </View>
      </Card>
    </Flex>
  );
}
