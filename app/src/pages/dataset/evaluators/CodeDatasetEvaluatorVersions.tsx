import { css } from "@emotion/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { formatRelative } from "date-fns/formatRelative";
import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";

import {
  Card,
  CopyToClipboardButton,
  Empty,
  Flex,
  Switch,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/CodeEvaluatorSourceCodeBlock";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useTheme } from "@phoenix/contexts";
import { useCurrentTime } from "@phoenix/hooks";
import type {
  CodeDatasetEvaluatorVersionsQuery,
  CodeDatasetEvaluatorVersionsQuery$data,
} from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorVersionsQuery.graphql";

type CodeEvaluator = Extract<
  Extract<
    CodeDatasetEvaluatorVersionsQuery$data["node"],
    { readonly __typename: "DatasetEvaluator" }
  >["evaluator"],
  { readonly __typename: "CodeEvaluator" }
>;

type VersionEdge = NonNullable<CodeEvaluator>["versions"]["edges"][number];
type Version = VersionEdge["node"];

const VERSIONS_LIST_WIDTH = 360;

const splitLayoutCSS = css`
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  min-height: 0;
`;

const listColCSS = css`
  width: ${VERSIONS_LIST_WIDTH}px;
  min-width: ${VERSIONS_LIST_WIDTH}px;
  height: 100%;
  overflow: auto;
  border-right: 1px solid var(--global-color-gray-300);
`;

const detailColCSS = css`
  flex: 1 1 auto;
  height: 100%;
  overflow: auto;
  min-width: 0;
`;

const versionItemCSS = css`
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--global-color-gray-300);
  text-align: left;
  cursor: pointer;
  padding: 0;
  color: inherit;
  transition: background-color 0.1s ease-in;

  &[data-active="true"],
  &:hover {
    background-color: var(--global-color-gray-200);
  }
`;

function VersionListItem({
  version,
  active,
  onSelect,
}: {
  version: Version;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const { nowEpochMs } = useCurrentTime();
  return (
    <button
      type="button"
      css={versionItemCSS}
      data-active={active}
      onClick={() => onSelect(version.id)}
    >
      <View width="100%" paddingY="size-100" paddingX="size-200">
        <Flex direction="column" gap="size-50">
          <Flex direction="row" gap="size-100" alignItems="center">
            <Token color="var(--global-color-blue-900)">
              {`v${version.sequenceNumber}`}
            </Token>
            <Truncate maxWidth="100%">
              <Text size="XS" color="text-700" fontFamily="mono">
                {version.id}
              </Text>
            </Truncate>
          </Flex>
          <View paddingStart="size-400">
            <Flex
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap="size-100"
            >
              <Flex direction="row" gap="size-50" alignItems="center">
                <UserPicture
                  size={14}
                  name={version.user?.username || "system"}
                  profilePictureUrl={version.user?.profilePictureUrl || null}
                />
                <Text size="XS">{version.user?.username || "system"}</Text>
              </Flex>
              <Text color="text-300" size="XS">
                {formatRelative(version.createdAt, nowEpochMs)}
              </Text>
            </Flex>
          </View>
        </Flex>
      </View>
    </button>
  );
}

function VersionDiffView({
  language,
  current,
  previous,
}: {
  language: CodeEvaluator["language"];
  current: Version;
  previous: NonNullable<Version["previousVersion"]>;
}) {
  const { theme } = useTheme();
  const filename = language === "PYTHON" ? "evaluator.py" : "evaluator.ts";
  const fileDiff = useMemo(
    () =>
      parseDiffFromFile(
        { name: filename, contents: previous.sourceCode },
        { name: filename, contents: current.sourceCode }
      ),
    [filename, previous.sourceCode, current.sourceCode]
  );
  return (
    <FileDiff
      fileDiff={fileDiff}
      options={{
        diffStyle: "unified",
        disableFileHeader: true,
        theme: { light: "pierre-light", dark: "pierre-dark" },
        themeType: theme,
      }}
    />
  );
}

function VersionDetail({
  language,
  version,
}: {
  language: CodeEvaluator["language"];
  version: Version;
}) {
  const [showDiff, setShowDiff] = useState(false);
  const previousVersion = version.previousVersion;
  const hasPreviousVersion = previousVersion != null;

  return (
    <View padding="size-200" width="100%">
      <Flex
        direction="column"
        gap="size-200"
        maxWidth={1000}
        marginStart="auto"
        marginEnd="auto"
      >
        <Card
          title={`Version ${version.sequenceNumber}`}
          extra={
            <Flex direction="row" alignItems="center" gap="size-200">
              <Switch
                labelPlacement="start"
                isSelected={showDiff && hasPreviousVersion}
                isDisabled={!hasPreviousVersion}
                onChange={setShowDiff}
              >
                Diff
              </Switch>
              <CopyToClipboardButton
                text={version.sourceCode}
                size="S"
                tooltipText="Copy code"
              />
            </Flex>
          }
        >
          {showDiff && previousVersion ? (
            <VersionDiffView
              language={language}
              current={version}
              previous={previousVersion}
            />
          ) : (
            <CodeEvaluatorSourceCodeBlock
              language={language}
              sourceCode={version.sourceCode}
            />
          )}
        </Card>
      </Flex>
    </View>
  );
}

export function CodeDatasetEvaluatorVersions({
  datasetEvaluatorId,
}: {
  datasetEvaluatorId: string;
}) {
  const data = useLazyLoadQuery<CodeDatasetEvaluatorVersionsQuery>(
    graphql`
      query CodeDatasetEvaluatorVersionsQuery($datasetEvaluatorId: ID!) {
        node(id: $datasetEvaluatorId) {
          __typename
          ... on DatasetEvaluator {
            evaluator {
              __typename
              ... on CodeEvaluator {
                id
                language
                versions(first: 50) {
                  edges {
                    node {
                      id
                      sequenceNumber
                      sourceCode
                      createdAt
                      user {
                        id
                        username
                        profilePictureUrl
                      }
                      previousVersion {
                        id
                        sourceCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { datasetEvaluatorId }
  );
  invariant(
    data.node.__typename === "DatasetEvaluator",
    "Invalid node for CodeDatasetEvaluatorVersions"
  );
  const evaluator = data.node.evaluator;
  invariant(
    evaluator.__typename === "CodeEvaluator",
    "Invalid evaluator for CodeDatasetEvaluatorVersions"
  );
  const versions = useMemo(
    () => evaluator.versions.edges.map((edge) => edge.node),
    [evaluator.versions.edges]
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    versions[0]?.id ?? null
  );

  if (versions.length === 0) {
    return (
      <Flex flex={1} alignItems="center" justifyContent="center">
        <Empty message="This code evaluator has no versions yet." />
      </Flex>
    );
  }

  const selectedVersion =
    versions.find((v) => v.id === selectedVersionId) ?? versions[0];

  return (
    <div css={splitLayoutCSS}>
      <div css={listColCSS}>
        <Flex direction="column">
          {versions.map((version) => (
            <VersionListItem
              key={version.id}
              version={version}
              active={selectedVersion.id === version.id}
              onSelect={setSelectedVersionId}
            />
          ))}
        </Flex>
      </div>
      <div css={detailColCSS}>
        <VersionDetail
          language={evaluator.language!}
          version={selectedVersion}
        />
      </div>
    </div>
  );
}
