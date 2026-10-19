import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";

import {
  Alert,
  Button,
  Card,
  CopyToClipboardButton,
  Flex,
  Heading,
  Link,
  LinkButton,
  PageHeader,
  Skeleton,
  Text,
  View,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { JSONBlock } from "@phoenix/components/code";
import { tableCSS } from "@phoenix/components/table/styles";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionPage_versions$key } from "./__generated__/DecisionPage_versions.graphql";
import type { DecisionPageQuery } from "./__generated__/DecisionPageQuery.graphql";
import type { DecisionPageVersionsQuery } from "./__generated__/DecisionPageVersionsQuery.graphql";
import {
  DeleteDecisionButton,
  DeleteDecisionTagButton,
  EditDecisionButton,
  SetDecisionTagButton,
} from "./DecisionActions";

export function DecisionPage() {
  const { decisionId, versionId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  if (!decisionId)
    return <Alert variant="danger">Decision ID is required.</Alert>;
  return (
    <div
      css={css`
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      `}
    >
      <Suspense
        fallback={
          <View padding="size-200">
            <Skeleton height={300} />
          </View>
        }
      >
        <DecisionDetails
          decisionId={decisionId}
          versionId={versionId ?? null}
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((key) => key + 1)}
        />
      </Suspense>
    </div>
  );
}

function DecisionDetails({
  decisionId,
  versionId,
  refreshKey,
  onRefresh,
}: {
  decisionId: string;
  versionId: string | null;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const { decision } = useLazyLoadQuery<DecisionPageQuery>(
    graphql`
      query DecisionPageQuery($id: ID!, $versionId: ID) {
        decision: node(id: $id) {
          __typename
          ... on Decision {
            id
            name
            description
            versionTags {
              id
              name
              decisionVersionId
            }
            ...DecisionPage_versions
            version(versionId: $versionId) {
              id
              description
              modelName
              modelProvider
              createdAt
              schemaVersion
              metadata
              customProvider {
                name
              }
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
            }
          }
        }
      }
    `,
    { id: decisionId, versionId },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey }
  );

  if (decision?.__typename !== "Decision")
    return (
      <View padding="size-200">
        <Alert variant="danger">
          Decision not found. It may have been deleted.
        </Alert>
        <Link to="/decisions">Back to decisions</Link>
      </View>
    );
  const version = decision.version;
  const versionJSON = version ? JSON.stringify(version, null, 2) : "";
  return (
    <>
      <PageHeader
        title={decision.name}
        subTitle={decision.description || "Versioned decision"}
        extra={
          <Flex gap="size-100" alignItems="center">
            <CopyToClipboardButton
              text={decision.id}
              aria-label="Copy decision ID"
            />
            <CanModify>
              <EditDecisionButton
                decisionId={decision.id}
                description={decision.description}
                onSaved={onRefresh}
              />
              <DeleteDecisionButton
                decisionId={decision.id}
                name={decision.name}
                onDeleted={() => navigate("/decisions")}
              />
            </CanModify>
            {version ? (
              <LinkButton
                variant="primary"
                to={`/playground?${new URLSearchParams({ decisionId: decision.id, decisionVersionId: version.id })}`}
              >
                Open in playground
              </LinkButton>
            ) : null}
          </Flex>
        }
      />
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Card title="Versions">
            <DecisionVersions
              query={decision}
              selectedVersionId={version?.id ?? null}
              decisionId={decision.id}
            />
          </Card>
          <Card
            title="Version tags"
            extra={
              <CanModify>
                {version ? (
                  <SetDecisionTagButton
                    versionId={version.id}
                    tagNames={decision.versionTags.map((tag) => tag.name)}
                    onSaved={onRefresh}
                  />
                ) : null}
              </CanModify>
            }
          >
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                {decision.versionTags.length ? (
                  decision.versionTags.map((tag) => (
                    <Flex key={tag.id} gap="size-200" alignItems="center">
                      <Link
                        to={`/decisions/${decision.id}/versions/${tag.decisionVersionId}`}
                      >
                        <TagVersionLabel>{tag.name}</TagVersionLabel>
                      </Link>
                      <Text>{tag.decisionVersionId}</Text>
                      <CanModify>
                        <DeleteDecisionTagButton
                          tagId={tag.id}
                          name={tag.name}
                          onDeleted={onRefresh}
                        />
                      </CanModify>
                    </Flex>
                  ))
                ) : (
                  <Text color="text-700">No version tags</Text>
                )}
              </Flex>
            </View>
          </Card>
          {!version ? (
            <Alert variant="danger">
              {versionId
                ? "This version does not belong to this decision or is unavailable. Choose a version above."
                : "This decision has no saved versions."}
            </Alert>
          ) : (
            <>
              <Card
                title="Selected version"
                extra={
                  <CopyToClipboardButton
                    text={versionJSON}
                    aria-label="Copy selected version"
                  />
                }
              >
                <View padding="size-200">
                  <Flex direction="column" gap="size-100">
                    <Text>{version.id}</Text>
                    <Text>
                      {version.modelName} ·{" "}
                      {version.customProvider?.name ?? version.modelProvider}
                    </Text>
                    <Text color="text-700">
                      Created {new Date(version.createdAt).toLocaleString()}
                    </Text>
                    {version.description ? (
                      <Text>{version.description}</Text>
                    ) : null}
                  </Flex>
                </View>
              </Card>
              <Card
                title="Inputs"
                extra={
                  <CopyToClipboardButton
                    text={JSON.stringify(version.inputs, null, 2)}
                  />
                }
              >
                <View padding="size-200">
                  <Flex direction="column" gap="size-200">
                    {version.inputs.map((input) => (
                      <Flex key={input.name} direction="column" gap="size-50">
                        <Heading level={3}>{input.name}</Heading>
                        {input.description ? (
                          <Text>{input.description}</Text>
                        ) : null}
                        {input.jsonSchema ? (
                          <JSONBlock
                            value={JSON.stringify(input.jsonSchema, null, 2)}
                          />
                        ) : null}
                      </Flex>
                    ))}
                  </Flex>
                </View>
              </Card>
              <Card
                title="State"
                extra={
                  <CopyToClipboardButton
                    text={JSON.stringify(version.state, null, 2)}
                  />
                }
              >
                <View padding="size-200">
                  {version.state.__typename === "DecisionTextState" ? (
                    <>
                      <Text color="text-700">
                        {version.state.templateFormat}
                      </Text>
                      <pre
                        css={css`
                          white-space: pre-wrap;
                          overflow-wrap: anywhere;
                        `}
                      >
                        {version.state.template}
                      </pre>
                    </>
                  ) : version.state.__typename === "DecisionInputState" ? (
                    <Text>Use input: {version.state.input}</Text>
                  ) : (
                    <Text>Send the declared inputs as a JSON object.</Text>
                  )}
                </View>
              </Card>
              <Card
                title="Questions"
                extra={
                  <CopyToClipboardButton
                    text={JSON.stringify(version.questions, null, 2)}
                  />
                }
              >
                <View padding="size-200">
                  <Flex direction="column" gap="size-200">
                    {version.questions.map((question, index) => {
                      if (question.__typename === "%other") return null;
                      return (
                        <Flex key={index} direction="column" gap="size-100">
                          <Heading level={3}>{question.name}</Heading>
                          <Text>{question.instructions}</Text>
                          {question.__typename ===
                          "DecisionPredicateQuestion" ? (
                            <Flex direction="column" gap="size-50">
                              <Text color="text-700">Predicate</Text>
                              {question.criteria?.true ? (
                                <Text>True: {question.criteria.true}</Text>
                              ) : null}
                              {question.criteria?.false ? (
                                <Text>False: {question.criteria.false}</Text>
                              ) : null}
                            </Flex>
                          ) : question.__typename ===
                            "DecisionChoiceQuestion" ? (
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
                          ) : question.__typename ===
                            "DecisionScaleQuestion" ? (
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
                </View>
              </Card>
              <Card
                title="Metadata"
                extra={
                  <CopyToClipboardButton
                    text={JSON.stringify(version.metadata, null, 2)}
                  />
                }
              >
                <JSONBlock value={JSON.stringify(version.metadata, null, 2)} />
              </Card>
            </>
          )}
        </Flex>
      </View>
    </>
  );
}

function DecisionVersions({
  query,
  selectedVersionId,
  decisionId,
}: {
  query: DecisionPage_versions$key;
  selectedVersionId: string | null;
  decisionId: string;
}) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    DecisionPageVersionsQuery,
    DecisionPage_versions$key
  >(
    graphql`
      fragment DecisionPage_versions on Decision
      @refetchable(queryName: "DecisionPageVersionsQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 20 }
        after: { type: "String" }
      ) {
        versions(first: $first, after: $after)
          @connection(key: "DecisionPage_versions") {
          edges {
            node {
              id
              createdAt
              description
              modelName
              tags {
                id
                name
              }
            }
          }
        }
      }
    `,
    query
  );
  return (
    <>
      <table css={tableCSS} aria-label="Decision versions">
        <thead>
          <tr>
            {["Version", "Model", "Description", "Tags", "Created"].map(
              (heading) => (
                <th scope="col" key={heading}>
                  {heading}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {data.versions.edges.map(({ node: version }) => (
            <tr
              key={version.id}
              aria-selected={version.id === selectedVersionId}
            >
              <td>
                <Link
                  to={`/decisions/${decisionId}/versions/${version.id}`}
                  aria-current={
                    version.id === selectedVersionId ? "page" : undefined
                  }
                >
                  {version.id}
                </Link>
              </td>
              <td>{version.modelName}</td>
              <td>{version.description || "—"}</td>
              <td>
                <Flex gap="size-100">
                  {version.tags.map((tag) => (
                    <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
                  ))}
                </Flex>
              </td>
              <td>{new Date(version.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasNext ? (
        <View padding="size-200">
          <Button onPress={() => loadNext(20)} isDisabled={isLoadingNext}>
            {isLoadingNext ? "Loading…" : "Load more versions"}
          </Button>
        </View>
      ) : null}
    </>
  );
}
