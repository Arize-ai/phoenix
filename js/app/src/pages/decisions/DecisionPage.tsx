import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import { useLocation, useNavigate, useParams } from "react-router";

import {
  Alert,
  Button,
  Card,
  Counter,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Link,
  LinkButton,
  PageHeader,
  Skeleton,
  Tab,
  TabList,
  Tabs,
  Text,
  Token,
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { JSONBlock } from "@phoenix/components/code";
import { tableCSS } from "@phoenix/components/table/styles";
import { UserDisplay } from "@phoenix/components/user/UserDisplay";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionPage_versions$key } from "./__generated__/DecisionPage_versions.graphql";
import type { DecisionPageQuery } from "./__generated__/DecisionPageQuery.graphql";
import type { DecisionPageVersionsQuery } from "./__generated__/DecisionPageVersionsQuery.graphql";
import { CloneDecisionDialog } from "./CloneDecisionDialog";
import {
  DeleteDecisionButton,
  DeleteDecisionTagButton,
  EditDecisionButton,
} from "./DecisionActions";
import { DecisionLabelConfigButton } from "./DecisionLabelConfigButton";
import { DecisionLabels } from "./DecisionLabels";
import { DecisionVersionDetails } from "./DecisionVersionDetails";

const mainCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .tabs {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    div[role="tablist"] {
      flex: none;
    }
    .tabs__pane-container {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      div[role="tabpanel"]:not([hidden]) {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        overflow: auto;
      }
    }
  }
`;

export function DecisionPage() {
  const { decisionId, versionId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  if (!decisionId)
    return <Alert variant="danger">Decision ID is required.</Alert>;
  return (
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
  const { pathname } = useLocation();
  const selectedTab = pathname.endsWith("/config")
    ? "config"
    : pathname.includes("/versions")
      ? "versions"
      : "decision";
  const { decision } = useLazyLoadQuery<DecisionPageQuery>(
    graphql`
      query DecisionPageQuery($id: ID!, $versionId: ID) {
        decision: node(id: $id) {
          __typename
          ... on Decision {
            id
            name
            description
            metadata
            versionCount
            sourceDecision {
              id
              name
            }
            versionTags {
              id
              name
              description
              decisionVersionId
            }
            # The version numbers the tag table shows; tags carry only ids.
            taggedVersionNumbers: versions(first: 100) {
              edges {
                node {
                  id
                  sequenceNumber
                }
              }
            }
            ...DecisionLabels
            ...DecisionPage_versions
            version(versionId: $versionId) {
              id
              ...DecisionVersionDetails_version
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
  const tagNames = decision.versionTags.map((tag) => tag.name);
  const versionNumberById = new Map(
    decision.taggedVersionNumbers.edges.map(({ node }) => [
      node.id,
      node.sequenceNumber,
    ])
  );
  const versionDetails = version ? (
    <DecisionVersionDetails
      versionRef={version}
      decisionId={decision.id}
      tagNames={tagNames}
      onRefresh={onRefresh}
      isOverview={selectedTab === "decision"}
    />
  ) : (
    <Alert variant="warning">This version could not be found.</Alert>
  );
  return (
    <main css={mainCSS}>
      <PageHeader
        title={decision.name}
        subTitle={
          decision.sourceDecision ? (
            <Text color="text-700">
              cloned from{" "}
              <Link to={`/decisions/${decision.sourceDecision.id}`}>
                {decision.sourceDecision.name}
              </Link>
            </Text>
          ) : undefined
        }
        extra={
          <Flex gap="size-100" alignItems="center">
            <CanModify>
              <DialogTrigger>
                <Button leadingVisual={<Icon svg={<Icons.GitBranch />} />}>
                  Clone
                </Button>
                <ViewportModalOverlay>
                  <ViewportModal size="M">
                    <CloneDecisionDialog
                      decisionId={decision.id}
                      decisionName={decision.name}
                      decisionDescription={decision.description ?? undefined}
                      decisionMetadata={decision.metadata ?? undefined}
                    />
                  </ViewportModal>
                </ViewportModalOverlay>
              </DialogTrigger>
            </CanModify>
            <LinkButton
              variant="primary"
              leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
              to={`/playground?${new URLSearchParams({ decisionId: decision.id, ...(version ? { decisionVersionId: version.id } : {}) })}`}
            >
              Playground
            </LinkButton>
          </Flex>
        }
      />
      <Tabs
        selectedKey={selectedTab}
        onSelectionChange={(key) =>
          navigate(
            `/decisions/${decision.id}${key === "decision" ? "" : `/${key}`}`
          )
        }
      >
        <TabList>
          <Tab id="decision">Decision</Tab>
          <Tab id="versions">
            Versions <Counter>{decision.versionCount}</Counter>
          </Tab>
          <Tab id="config">Config</Tab>
        </TabList>
        <LazyTabPanel id="decision">
          <div
            css={css`
              display: flex;
              flex: 1 1 auto;
              min-width: 0;
              @media (max-width: 1000px) {
                flex-direction: column;
              }
            `}
          >
            <div
              css={css`
                flex: 1 1 auto;
                min-width: 0;
                padding: var(--global-dimension-size-200);
                overflow: auto;
              `}
            >
              {versionDetails}
            </div>
            <aside
              css={css`
                flex: 0 0 400px;
                border-left: 1px solid var(--global-border-color-default);
                padding: var(--global-dimension-size-200);
                overflow: auto;
              `}
            >
              <Flex direction="column" gap="size-200">
                <Card
                  title="Description"
                  extra={
                    <CanModify>
                      <EditDecisionButton
                        decisionId={decision.id}
                        description={decision.description}
                        metadata={decision.metadata}
                        onSaved={onRefresh}
                      />
                    </CanModify>
                  }
                >
                  <View padding="size-200">
                    <Text>{decision.description || "No description"}</Text>
                  </View>
                </Card>
                <Card
                  title="Labels"
                  extra={
                    <CanModify>
                      <DecisionLabelConfigButton decisionId={decision.id} />
                    </CanModify>
                  }
                >
                  <View padding="size-200">
                    <DecisionLabels decision={decision} />
                  </View>
                </Card>
                <Card title="Metadata">
                  <JSONBlock
                    value={JSON.stringify(decision.metadata, null, 2)}
                  />
                </Card>
                <Card title="Latest versions">
                  <DecisionVersions
                    query={decision}
                    selectedVersionId={version?.id ?? null}
                    decisionId={decision.id}
                    isOverview
                  />
                </Card>
              </Flex>
            </aside>
          </div>
        </LazyTabPanel>
        <LazyTabPanel id="versions">
          <div
            css={css`
              display: flex;
              flex: 1 1 auto;
              min-width: 0;
              @media (max-width: 800px) {
                flex-direction: column;
              }
            `}
          >
            <aside
              css={css`
                flex: 0 0 400px;
                border-right: 1px solid var(--global-border-color-default);
                overflow: auto;
              `}
            >
              <DecisionVersions
                query={decision}
                selectedVersionId={version?.id ?? null}
                decisionId={decision.id}
              />
            </aside>
            <div
              css={css`
                flex: 1 1 auto;
                min-width: 0;
                overflow: auto;
                padding: var(--global-dimension-size-200);
              `}
            >
              {versionDetails}
            </div>
          </div>
        </LazyTabPanel>
        <LazyTabPanel id="config">
          <View padding="size-200" width="100%">
            <Flex
              direction="column"
              gap="size-200"
              maxWidth={900}
              marginStart="auto"
              marginEnd="auto"
            >
              <Card title="Version tags">
                <table css={tableCSS} aria-label="Decision version tags">
                  <thead>
                    <tr>
                      <th scope="col">Tag</th>
                      <th scope="col">Version</th>
                      <th scope="col">Description</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decision.versionTags.map((tag) => (
                      <tr key={tag.id}>
                        <td>
                          <TagVersionLabel>{tag.name}</TagVersionLabel>
                        </td>
                        <td>
                          <Link
                            to={`/decisions/${decision.id}/versions/${tag.decisionVersionId}`}
                          >
                            {versionNumberById.has(tag.decisionVersionId)
                              ? `Version ${versionNumberById.get(tag.decisionVersionId)}`
                              : tag.decisionVersionId}
                          </Link>
                        </td>
                        <td>{tag.description || "—"}</td>
                        <td>
                          <CanModify>
                            <DeleteDecisionTagButton
                              tagId={tag.id}
                              name={tag.name}
                              onDeleted={onRefresh}
                            />
                          </CanModify>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {decision.versionTags.length === 0 ? (
                  <View padding="size-200">
                    <Text color="text-700">
                      No version tags. Select a version to add a tag.
                    </Text>
                  </View>
                ) : null}
              </Card>
              <Card title="Decision settings">
                <View padding="size-200">
                  <Flex justifyContent="space-between" gap="size-100">
                    <LinkButton to="/settings/decisions">
                      Manage decision labels
                    </LinkButton>
                    <CanModify>
                      <DeleteDecisionButton
                        decisionId={decision.id}
                        name={decision.name}
                        onDeleted={() => navigate("/decisions")}
                      />
                    </CanModify>
                  </Flex>
                </View>
              </Card>
            </Flex>
          </View>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}

function DecisionVersions({
  query,
  selectedVersionId,
  decisionId,
  isOverview = false,
}: {
  query: DecisionPage_versions$key;
  selectedVersionId: string | null;
  decisionId: string;
  isOverview?: boolean;
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
              sequenceNumber
              createdAt
              description
              modelName
              user {
                username
                profilePictureUrl
              }
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
  const versions = isOverview
    ? data.versions.edges.slice(0, 5)
    : data.versions.edges;
  return (
    <Flex direction="column">
      {versions.map(({ node: version }) => (
        <View
          key={version.id}
          padding="size-200"
          borderBottomWidth="thin"
          borderColor="default"
          backgroundColor={
            version.id === selectedVersionId && !isOverview
              ? "gray-100"
              : undefined
          }
        >
          <Flex direction="column" gap="size-100">
            <Flex justifyContent="space-between" gap="size-100">
              <Link
                to={`/decisions/${decisionId}/versions/${version.id}`}
                aria-current={
                  version.id === selectedVersionId && !isOverview
                    ? "page"
                    : undefined
                }
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <Token color="var(--global-color-blue-900)">
                    {version.sequenceNumber}
                  </Token>
                  <span>{version.id}</span>
                </Flex>
              </Link>
              <Text color="text-700">
                {new Date(version.createdAt).toLocaleDateString()}
              </Text>
            </Flex>
            {version.description ? <Text>{version.description}</Text> : null}
            <Text color="text-700">{version.modelName}</Text>
            <UserDisplay user={version.user} />
            <Flex gap="size-100" wrap>
              {version.tags.map((tag) => (
                <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
              ))}
            </Flex>
          </Flex>
        </View>
      ))}
      {isOverview ? (
        <View padding="size-200">
          <Link to={`/decisions/${decisionId}/versions`}>
            View all versions
          </Link>
        </View>
      ) : hasNext ? (
        <View padding="size-200">
          <Button onPress={() => loadNext(20)} isDisabled={isLoadingNext}>
            {isLoadingNext ? "Loading…" : "Load more versions"}
          </Button>
        </View>
      ) : null}
    </Flex>
  );
}
