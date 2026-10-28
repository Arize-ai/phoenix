import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  usePreloadedQuery,
} from "react-relay";
import {
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";

import {
  Card,
  Flex,
  Loading,
  Switch,
  Text,
  TitleWithID,
  View,
} from "@phoenix/components";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";
import type { PromptVersionLoaderData } from "@phoenix/pages/prompt/promptVersionLoader";
import { promptVersionLoaderQuery } from "@phoenix/pages/prompt/promptVersionLoader";

import { TagPromptVersionButton } from "../../components/prompt/TagPromptVersionButton";
import type { promptLoaderQuery as PromptLoaderQuery } from "./__generated__/promptLoaderQuery.graphql";
import type { PromptVersionDetailsPage__prompt$key } from "./__generated__/PromptVersionDetailsPage__prompt.graphql";
import type { PromptVersionDetailsPageCompareQuery } from "./__generated__/PromptVersionDetailsPageCompareQuery.graphql";
import type {
  promptVersionLoaderQuery as PromptVersionLoaderQuery,
  promptVersionLoaderQuery$data,
} from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { promptLoaderQuery } from "./promptLoader";
import {
  PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH,
  PROMPT_PAGE_TWO_COLUMN_MAX_WIDTH,
  PROMPT_PAGE_TWO_COLUMN_MIN_WIDTH,
} from "./promptPageLayout";
import { PromptVersionDiffPicker } from "./PromptVersionDiffPicker";
import { PromptVersionDiffView } from "./PromptVersionDiffView";
import { PromptVersionMetadataCard } from "./PromptVersionMetadataCard";
import { PromptVersionTagsList } from "./PromptVersionTagsList";
import { usePromptIdLoader } from "./usePromptIdLoader";

type PromptVersion = promptVersionLoaderQuery$data["promptVersion"];

/**
 * In one column the column wrappers dissolve so that `order` can interleave
 * the two columns' sections into a single stack
 */
const layoutCSS = css`
  container-type: inline-size;
  .prompt-version-details__layout {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-200);
    max-width: ${PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH}px;
    margin-inline: auto;
  }
  .prompt-version-details__column {
    display: contents;
  }
  .prompt-version-details__section {
    min-width: 0;
  }
  .prompt-version-details__section--version {
    order: 1;
  }
  .prompt-version-details__section--prompt {
    order: 2;
  }
  .prompt-version-details__section--model {
    order: 3;
  }
  .prompt-version-details__section--metadata {
    order: 4;
  }
  .prompt-version-details__section--code {
    order: 5;
  }
  @container (min-width: ${PROMPT_PAGE_TWO_COLUMN_MIN_WIDTH}px) {
    .prompt-version-details__layout {
      flex-direction: row;
      align-items: flex-start;
      max-width: ${PROMPT_PAGE_TWO_COLUMN_MAX_WIDTH}px;
    }
    .prompt-version-details__column {
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-200);
      min-width: 0;
    }
    .prompt-version-details__column--primary {
      flex: 3 1 0;
    }
    .prompt-version-details__column--secondary {
      flex: 2 1 0;
    }
  }
`;

export function PromptVersionDetailsPage() {
  const loaderData = useLoaderData<PromptVersionLoaderData>();
  const data = useOwnedPreloadedQuery<PromptVersionLoaderQuery>({
    query: promptVersionLoaderQuery,
    queryRef: loaderData.queryRef,
  });
  const promptLoaderData = usePromptIdLoader();
  const promptData = usePreloadedQuery<PromptLoaderQuery>(
    promptLoaderQuery,
    promptLoaderData.queryRef
  );
  return (
    <PromptVersionDetailsPageContent
      key={data.promptVersion.id}
      promptVersion={data.promptVersion}
      prompt={promptData.prompt}
    />
  );
}

function PromptVersionDetailsPageContent({
  promptVersion,
  prompt,
}: {
  promptVersion: PromptVersion;
  prompt: PromptVersionDetailsPage__prompt$key;
}) {
  const { promptId } = useParams();
  invariant(promptId, "promptId is required");
  return (
    <View width="100%" overflow="auto" elementType="section">
      <View padding="size-200" width="100%">
        <div css={layoutCSS}>
          <div className="prompt-version-details__layout">
            <div className="prompt-version-details__column prompt-version-details__column--primary">
              <div className="prompt-version-details__section prompt-version-details__section--prompt">
                <PromptVersionPromptCard
                  promptVersion={promptVersion}
                  prompt={prompt}
                />
              </div>
              <div className="prompt-version-details__section prompt-version-details__section--code">
                <PromptCodeExportCard promptVersion={promptVersion} />
              </div>
            </div>
            <div className="prompt-version-details__column prompt-version-details__column--secondary">
              <div className="prompt-version-details__section prompt-version-details__section--version">
                <Flex direction="column" gap="size-100">
                  <Flex
                    direction="row"
                    gap="size-100"
                    alignItems="center"
                    wrap="wrap"
                  >
                    <TitleWithID title="Version" id={promptVersion.id} />
                    <PromptVersionTagsList
                      promptVersion={promptVersion}
                      action={
                        <TagPromptVersionButton
                          promptId={promptId}
                          versionId={promptVersion.id}
                        />
                      }
                    />
                  </Flex>
                  {promptVersion.description ? (
                    <Text color="text-700">{promptVersion.description}</Text>
                  ) : null}
                </Flex>
              </div>
              <div className="prompt-version-details__section prompt-version-details__section--model">
                <PromptModelConfigurationCard promptVersion={promptVersion} />
              </div>
              <div className="prompt-version-details__section prompt-version-details__section--metadata">
                <PromptVersionMetadataCard promptVersion={promptVersion} />
              </div>
            </div>
          </div>
        </div>
      </View>
    </View>
  );
}

const COMPARE_VERSION_SEARCH_PARAM = "compareVersionId";
const NEWER_VERSION_COLOR = "var(--global-color-success)";
const OLDER_VERSION_COLOR = "var(--global-color-danger)";

type ComparedVersion = { id: string; sequenceNumber: number };

/**
 * The version's prompt, or its diff against another version of the prompt.
 * The diff compares against the previous version until another is chosen.
 * The compared version lives in the URL so that it survives switching the
 * viewed version. The diff always reads from the older version to the newer
 * one, so the viewed version takes the deletion color when it is the older.
 */
function PromptVersionPromptCard({
  promptVersion,
  prompt,
}: {
  promptVersion: PromptVersion;
  prompt: PromptVersionDetailsPage__prompt$key;
}) {
  const { promptId } = useParams();
  invariant(promptId, "promptId is required");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const promptData = useFragment<PromptVersionDetailsPage__prompt$key>(
    graphql`
      fragment PromptVersionDetailsPage__prompt on Prompt {
        latestVersions: promptVersions(first: 2) {
          edges {
            node {
              id
            }
          }
        }
        ...PromptVersionDiffPicker__versions
      }
    `,
    prompt
  );
  const viewedSequenceNumber = promptVersion.sequenceNumber;
  invariant(viewedSequenceNumber != null, "a prompt version is required");
  const previousVersion = promptVersion.previousVersion;
  const defaultCompareVersionId =
    previousVersion?.id ??
    promptData.latestVersions.edges.find(
      ({ node }) => node.id !== promptVersion.id
    )?.node.id;
  const requestedCompareVersionId = searchParams.get(
    COMPARE_VERSION_SEARCH_PARAM
  );
  const compareVersionId =
    requestedCompareVersionId !== promptVersion.id
      ? requestedCompareVersionId
      : null;
  const setCompareVersionId = (versionId: string | null) => {
    setSearchParams(
      (params) => {
        const nextParams = new URLSearchParams(params);
        if (versionId == null) {
          nextParams.delete(COMPARE_VERSION_SEARCH_PARAM);
        } else {
          nextParams.set(COMPARE_VERSION_SEARCH_PARAM, versionId);
        }
        return nextParams;
      },
      { replace: true }
    );
  };
  const viewVersion = (versionId: string) => {
    const params = new URLSearchParams(searchParams);
    navigate(`/prompts/${promptId}/versions/${versionId}?${params}`);
  };
  const renderCard = ({
    comparedVersion,
    children,
  }: {
    comparedVersion: ComparedVersion | null;
    children: ReactNode;
  }) => {
    const isCompareNewer =
      comparedVersion != null &&
      comparedVersion.sequenceNumber > viewedSequenceNumber;
    return (
      <Card
        title="Prompt"
        collapsible
        data-testid="prompt-chat-messages-card"
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {comparedVersion != null ? (
              <>
                <PromptVersionDiffPicker
                  prompt={promptData}
                  color={
                    isCompareNewer ? OLDER_VERSION_COLOR : NEWER_VERSION_COLOR
                  }
                  excludedVersionId={comparedVersion.id}
                  selectedVersionId={promptVersion.id}
                  selectedSequenceNumber={viewedSequenceNumber}
                  onSelectionChange={viewVersion}
                  aria-label="Viewed version"
                />
                <PromptVersionDiffPicker
                  prompt={promptData}
                  color={
                    isCompareNewer ? NEWER_VERSION_COLOR : OLDER_VERSION_COLOR
                  }
                  excludedVersionId={promptVersion.id}
                  selectedVersionId={comparedVersion.id}
                  selectedSequenceNumber={comparedVersion.sequenceNumber}
                  onSelectionChange={setCompareVersionId}
                  aria-label="Version to compare against"
                />
              </>
            ) : null}
            <Switch
              labelPlacement="start"
              isSelected={compareVersionId != null}
              isDisabled={defaultCompareVersionId == null}
              onChange={(isSelected) =>
                setCompareVersionId(
                  isSelected ? (defaultCompareVersionId ?? null) : null
                )
              }
            >
              Diff
            </Switch>
          </Flex>
        }
      >
        {children}
      </Card>
    );
  };
  const messages = (
    <View padding="size-200">
      <PromptChatMessages promptVersion={promptVersion} />
    </View>
  );
  if (compareVersionId == null) {
    return renderCard({ comparedVersion: null, children: messages });
  }
  if (previousVersion != null && compareVersionId === previousVersion.id) {
    return renderCard({
      comparedVersion: previousVersion,
      children: (
        <PromptVersionDiffView
          oldVersion={previousVersion}
          newVersion={promptVersion}
        />
      ),
    });
  }
  return (
    <Suspense
      fallback={renderCard({
        comparedVersion: null,
        children: (
          <View padding="size-200">
            <Loading />
          </View>
        ),
      })}
    >
      <PromptVersionCompareDiff
        viewedVersion={promptVersion}
        viewedSequenceNumber={viewedSequenceNumber}
        compareVersionId={compareVersionId}
        renderCard={renderCard}
        fallback={messages}
      />
    </Suspense>
  );
}

/**
 * Diffs the viewed version against a version that the page has not loaded,
 * such as one chosen from the picker or named in the URL. A compared id that
 * is not a prompt version shows the viewed version alone.
 */
function PromptVersionCompareDiff({
  viewedVersion,
  viewedSequenceNumber,
  compareVersionId,
  renderCard,
  fallback,
}: {
  viewedVersion: PromptVersion;
  viewedSequenceNumber: number;
  compareVersionId: string;
  renderCard: (props: {
    comparedVersion: ComparedVersion | null;
    children: ReactNode;
  }) => ReactNode;
  fallback: ReactNode;
}) {
  const { compareVersion } =
    useLazyLoadQuery<PromptVersionDetailsPageCompareQuery>(
      graphql`
        query PromptVersionDetailsPageCompareQuery($id: ID!) {
          compareVersion: node(id: $id) {
            __typename
            id
            ... on PromptVersion {
              sequenceNumber
              ...PromptVersionDiffView__template
            }
          }
        }
      `,
      { id: compareVersionId }
    );
  const { sequenceNumber } = compareVersion;
  if (compareVersion.__typename !== "PromptVersion" || sequenceNumber == null) {
    return renderCard({ comparedVersion: null, children: fallback });
  }
  const isCompareNewer = sequenceNumber > viewedSequenceNumber;
  return renderCard({
    comparedVersion: { id: compareVersion.id, sequenceNumber },
    children: isCompareNewer ? (
      <PromptVersionDiffView
        oldVersion={viewedVersion}
        newVersion={compareVersion}
      />
    ) : (
      <PromptVersionDiffView
        oldVersion={compareVersion}
        newVersion={viewedVersion}
      />
    ),
  });
}
