import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Heading } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useLocation, useNavigate, useParams } from "react-router";

import {
  Alert,
  Button,
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
  View,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import { JSONBlock } from "@phoenix/components/code";

import type { DecisionPageQuery } from "./__generated__/DecisionPageQuery.graphql";
import { CloneDecisionDialog } from "./CloneDecisionDialog";
import { DecisionLabelConfigButton } from "./DecisionLabelConfigButton";
import { DecisionLabels } from "./DecisionLabels";
import { DecisionLatestVersionsList } from "./DecisionLatestVersionsList";
import { DecisionVersionDetails } from "./DecisionVersionDetails";
import { DecisionVersionsList } from "./DecisionVersionsList";
import { DecisionVersionTagsConfigCard } from "./DecisionVersionTagsConfigCard";
import { EditDecisionButton } from "./EditDecisionButton";

// The same shell as PromptLayout: the tabs fill the page and each tab's
// panes scroll on their own.
const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
    .tabs__pane-container {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      div[role="tabpanel"]:not([hidden]) {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
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
            ...DecisionLabels
            ...DecisionLatestVersionsList_decision
            ...DecisionVersionsList_versions
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
        <Link to="/prompts/decisions">Back to decisions</Link>
      </View>
    );
  const version = decision.version;
  const decisionTagNames = decision.versionTags.map((tag) => tag.name);
  const versionDetails = (isOverview: boolean) =>
    version ? (
      <DecisionVersionDetails
        versionRef={version}
        decisionId={decision.id}
        decisionTagNames={decisionTagNames}
        onRefresh={onRefresh}
        isOverview={isOverview}
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
              <Link to={`/prompts/decisions/${decision.sourceDecision.id}`}>
                {decision.sourceDecision.name}
              </Link>
            </Text>
          ) : undefined
        }
        extra={
          <Flex direction="row" gap="size-100" justifyContent="end">
            <CanModify>
              <DialogTrigger>
                <Button
                  size="M"
                  leadingVisual={<Icon svg={<Icons.GitBranch />} />}
                >
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
              to={`/playground?decisionId=${encodeURIComponent(decision.id)}`}
              size="M"
              aria-label="Open this Decision in Playground"
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
            `/prompts/decisions/${decision.id}${key === "decision" ? "" : `/${key}`}`
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
          <Flex direction="row" height="100%">
            <View
              height="100%"
              overflow="auto"
              width="100%"
              data-testid="scroll-container"
            >
              <View padding="size-200">{versionDetails(true)}</View>
            </View>
            <View
              flex="none"
              width={400}
              height="100%"
              borderStartColor="default"
              borderStartWidth="thin"
            >
              <View padding="size-200" overflow="auto" height="100%">
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Heading level={3}>Description</Heading>
                  <CanModify>
                    <EditDecisionButton
                      decisionId={decision.id}
                      description={decision.description}
                      metadata={decision.metadata}
                      onSaved={onRefresh}
                    />
                  </CanModify>
                </Flex>
                <Text color={decision.description ? "text-900" : "text-700"}>
                  {decision.description || "No Description"}
                </Text>
                <section>
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Heading level={3}>Labels</Heading>
                    <CanModify>
                      <DecisionLabelConfigButton decisionId={decision.id} />
                    </CanModify>
                  </Flex>
                  <DecisionLabels decision={decision} />
                </section>
                <section>
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Heading level={3}>Metadata</Heading>
                    <CanModify>
                      <EditDecisionButton
                        decisionId={decision.id}
                        description={decision.description}
                        metadata={decision.metadata}
                        onSaved={onRefresh}
                      />
                    </CanModify>
                  </Flex>
                  <JSONBlock
                    value={
                      decision.metadata
                        ? JSON.stringify(decision.metadata, null, 2)
                        : "{}"
                    }
                  />
                </section>
                <section>
                  <Heading level={3}>Latest Versions</Heading>
                  <DecisionLatestVersionsList decisionRef={decision} />
                </section>
              </View>
            </View>
          </Flex>
        </LazyTabPanel>
        <LazyTabPanel id="versions">
          <View height="100%">
            <Flex direction="row" height="100%">
              <DecisionVersionsList
                decisionRef={decision}
                decisionId={decision.id}
                selectedVersionId={versionId}
              />
              <View width="100%" overflow="auto" elementType="section">
                <View padding="size-200" width="100%" overflow="auto">
                  {versionDetails(false)}
                </View>
              </View>
            </Flex>
          </View>
        </LazyTabPanel>
        <LazyTabPanel id="config">
          <Flex direction="row" height="100%">
            <View
              height="100%"
              overflow="auto"
              width="100%"
              data-testid="scroll-container"
            >
              <View padding="size-200">
                <Flex
                  direction="column"
                  gap="size-200"
                  marginStart="auto"
                  marginEnd="auto"
                  maxWidth={900}
                >
                  <DecisionVersionTagsConfigCard
                    decisionId={decision.id}
                    versionTags={decision.versionTags}
                    onDeleted={onRefresh}
                  />
                </Flex>
              </View>
            </View>
          </Flex>
        </LazyTabPanel>
      </Tabs>
    </main>
  );
}
