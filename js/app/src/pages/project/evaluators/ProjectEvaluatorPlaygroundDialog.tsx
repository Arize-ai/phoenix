import { css } from "@emotion/react";
import { Suspense, useDeferredValue, useState, useTransition } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  NumberField,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { Loading } from "@phoenix/components/core/loading";
import { DatasetSelectWithSplits } from "@phoenix/components/dataset/DatasetSelectWithSplits";
import type { ProjectEvaluatorPlaygroundDialogMatchingSpansQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorPlaygroundDialogMatchingSpansQuery.graphql";
import type { ProjectEvaluatorPlaygroundDialogMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorPlaygroundDialogMutation.graphql";
import type { ProjectEvaluatorPlaygroundDialogSpanCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorPlaygroundDialogSpanCountQuery.graphql";
import {
  DEFAULT_EXPORTED_SPANS,
  getDefaultExportedDatasetName,
  getProjectEvaluatorPlaygroundPath,
  isValidExportedSpanLimit,
  MAX_EXPORTED_SPANS,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPlaygroundUtils";
import {
  RecordContextViewer,
  RecordPreviewCard,
  RecordPreviewList,
} from "@phoenix/pages/project/evaluators/RecordPreviewList";
import { SpanFilterConditionFieldCore } from "@phoenix/pages/project/SpanFilterConditionField";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { formatInt } from "@phoenix/utils/numberFormatUtils";

type DatasetSource = "export" | "existing";

/** Scrolls between the fixed header and footer once the span preview grows. */
const dialogBodyCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--global-dimension-size-200);
`;

/**
 * Both sources share one grid cell, so the body is always as tall as the
 * taller one: switching sources never moves the toggle or the footer, and
 * each source keeps what was entered in it.
 */
const dataSourcePanesCSS = css`
  display: grid;
  .dataset-source-pane {
    grid-area: 1 / 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-200);
  }
  /* Opacity, not visibility: children inherit visibility, and those with a
     "transition: all" would stay visible until their transition ends. */
  .dataset-source-pane[inert] {
    opacity: 0;
  }
`;

export type ProjectEvaluatorPlaygroundDialogProps = {
  projectId: string;
  projectEvaluatorId: string;
  evaluatorName: string;
  /** The evaluator's own span filter, which the export starts from. */
  filterCondition: string;
};

/**
 * Picks the dataset a span evaluator runs over in the playground: the latest
 * spans matching its filter, exported to a new dataset, or one that exists.
 */
export function ProjectEvaluatorPlaygroundDialog(
  props: ProjectEvaluatorPlaygroundDialogProps
) {
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open in playground</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton
                close={close}
                aria-label="Close"
                leadingVisual={<Icon svg={<Icons.Close />} />}
              />
            </DialogTitleExtra>
          </DialogHeader>
          <Suspense fallback={<Loading />}>
            <ProjectEvaluatorPlaygroundDialogBody {...props} close={close} />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ProjectEvaluatorPlaygroundDialogBody({
  projectId,
  projectEvaluatorId,
  evaluatorName,
  filterCondition: evaluatorFilterCondition,
  close,
}: ProjectEvaluatorPlaygroundDialogProps & { close: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<DatasetSource>("export");
  const [filterDraft, setFilterDraft] = useState(evaluatorFilterCondition);
  const [filterCondition, setFilterCondition] = useState(
    evaluatorFilterCondition
  );
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [limit, setLimit] = useState(DEFAULT_EXPORTED_SPANS);
  const [datasetName, setDatasetName] = useState(() =>
    getDefaultExportedDatasetName({ evaluatorName, now: new Date() })
  );
  const [existing, setExisting] = useState<{
    datasetId: string | null;
    splitIds: string[];
  }>({ datasetId: null, splitIds: [] });

  // Keeps the last count on screen while the next one loads.
  const countedFilterCondition = useDeferredValue(filterCondition);
  const isCounting = countedFilterCondition !== filterCondition;
  const { project } =
    useLazyLoadQuery<ProjectEvaluatorPlaygroundDialogSpanCountQuery>(
      graphql`
        query ProjectEvaluatorPlaygroundDialogSpanCountQuery(
          $projectId: ID!
          $filterCondition: String
        ) {
          project: node(id: $projectId) {
            ... on Project {
              matchingSpanCount: recordCount(filterCondition: $filterCondition)
            }
          }
        }
      `,
      { projectId, filterCondition: countedFilterCondition },
      { fetchPolicy: "store-and-network" }
    );
  const matchingSpanCount = project.matchingSpanCount ?? 0;

  const [commitExport, isExporting] =
    useMutation<ProjectEvaluatorPlaygroundDialogMutation>(graphql`
      mutation ProjectEvaluatorPlaygroundDialogMutation(
        $input: CreateDatasetFromSpansInput!
      ) {
        createDatasetFromSpans(input: $input) {
          dataset {
            id
          }
        }
      }
    `);

  const openPlayground = ({
    datasetId,
    splitIds,
  }: {
    datasetId: string;
    splitIds?: string[];
  }) => {
    close();
    navigate(
      getProjectEvaluatorPlaygroundPath({
        projectEvaluatorId,
        datasetId,
        splitIds,
      })
    );
  };

  const onExport = () => {
    setError(null);
    commitExport({
      variables: {
        input: {
          projectId,
          name: datasetName.trim(),
          filterCondition,
          limit,
          metadata: {
            source: "project_evaluator",
            projectEvaluatorId,
            filterCondition,
            limit,
          },
        },
      },
      onCompleted: (response, errors) => {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
          return;
        }
        openPlayground({
          datasetId: response.createDatasetFromSpans.dataset.id,
        });
      },
      onError: (mutationError) => {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
            mutationError.message
        );
      },
    });
  };

  const hasNoMatches = !isCounting && matchingSpanCount === 0;
  const canExport =
    isFilterValid &&
    !isCounting &&
    matchingSpanCount > 0 &&
    isValidExportedSpanLimit(limit) &&
    datasetName.trim() !== "" &&
    !isExporting;
  const exportedSpanCount = Math.min(matchingSpanCount, limit);

  return (
    <>
      {error ? (
        <View paddingX="size-200" paddingTop="size-100">
          <Alert variant="danger" banner>
            {error}
          </Alert>
        </View>
      ) : null}
      <div css={dialogBodyCSS}>
        <Flex direction="column" gap="size-200">
          <Text color="text-700">
            The playground runs this evaluator over a dataset. Export the latest
            spans it would score, or use a dataset you already have.
          </Text>
          <SegmentedControl
            aria-label="Dataset source"
            selectedKey={source}
            onSelectionChange={(key) => {
              if (key === "export" || key === "existing") {
                setError(null);
                setSource(key);
              }
            }}
          >
            <SegmentedControlItem id="export">
              Export recent spans
            </SegmentedControlItem>
            <SegmentedControlItem id="existing">
              Use existing dataset
            </SegmentedControlItem>
          </SegmentedControl>
          <div css={dataSourcePanesCSS}>
            <div className="dataset-source-pane" inert={source !== "export"}>
              <Text size="S" color="text-700">
                Creates a new dataset from the latest spans that match the
                filter.
              </Text>
              <Flex direction="row" gap="size-200">
                <NumberField
                  value={limit}
                  onChange={setLimit}
                  minValue={1}
                  maxValue={MAX_EXPORTED_SPANS}
                  step={1}
                  css={css`
                    width: 160px;
                    flex: none;
                  `}
                >
                  <Label>Latest spans</Label>
                  <Input />
                  <Text slot="description">At most {MAX_EXPORTED_SPANS}</Text>
                </NumberField>
                <TextField
                  value={datasetName}
                  onChange={setDatasetName}
                  isRequired
                  css={css`
                    flex: 1 1 auto;
                  `}
                >
                  <Label>New dataset name</Label>
                  <Input />
                </TextField>
              </Flex>
              <Flex direction="column" gap="size-50">
                <Text size="XS" weight="heavy" color="text-700">
                  Span filter
                </Text>
                <SpanFilterConditionFieldCore
                  projectId={projectId}
                  filterCondition={filterDraft}
                  onFilterConditionChange={setFilterDraft}
                  onValidCondition={({ condition }) =>
                    setFilterCondition(condition)
                  }
                  onValidityChange={setIsFilterValid}
                  placeholder="span_kind == 'LLM'"
                />
                <Text size="XS" color="text-500">
                  Starts as this evaluator&apos;s filter, so the dataset holds
                  the kind of spans it scores.
                </Text>
              </Flex>
              <div
                role="status"
                css={css`
                  min-height: var(--global-line-height-s);
                `}
              >
                {hasNoMatches ? (
                  <Alert variant="warning">
                    No spans in this project match the filter. Change the
                    filter, or use an existing dataset.
                  </Alert>
                ) : (
                  <Text size="S" color={isCounting ? "text-500" : undefined}>
                    {isCounting
                      ? "Counting matching spans..."
                      : `${formatInt(matchingSpanCount)} spans match. The latest ${formatInt(exportedSpanCount)} will be exported.`}
                  </Text>
                )}
              </div>
              {hasNoMatches ? null : (
                <Suspense fallback={<Loading />}>
                  <MatchingSpanPreview
                    // A new filter starts again from the first page.
                    key={countedFilterCondition}
                    projectId={projectId}
                    filterCondition={countedFilterCondition}
                  />
                </Suspense>
              )}
            </div>
            <div className="dataset-source-pane" inert={source !== "existing"}>
              <DatasetSelectWithSplits
                label="Dataset"
                placeholder="Select a dataset"
                value={existing}
                onSelectionChange={setExisting}
              />
            </div>
          </div>
        </Flex>
      </div>
      <DialogFooter>
        <Flex direction="row" gap="size-100">
          <Button variant="default" size="M" onPress={close}>
            Cancel
          </Button>
          {source === "export" ? (
            <Button
              variant="primary"
              size="M"
              isDisabled={!canExport}
              onPress={onExport}
            >
              {isExporting ? "Exporting..." : "Export & open playground"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="M"
              isDisabled={existing.datasetId == null}
              onPress={() => {
                if (existing.datasetId) {
                  openPlayground({
                    datasetId: existing.datasetId,
                    splitIds: existing.splitIds,
                  });
                }
              }}
            >
              Open playground
            </Button>
          )}
        </Flex>
      </DialogFooter>
    </>
  );
}

const MATCHING_SPAN_PREVIEW_PAGE_SIZE = 3;

/**
 * The newest spans the filter matches, which are the first the export takes,
 * each expandable to the context it becomes an example with.
 */
function MatchingSpanPreview({
  projectId,
  filterCondition,
}: {
  projectId: string;
  filterCondition: string;
}) {
  const [limit, setLimit] = useState(MATCHING_SPAN_PREVIEW_PAGE_SIZE);
  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const [expandedSpanId, setExpandedSpanId] = useState<string | null>(null);
  const data =
    useLazyLoadQuery<ProjectEvaluatorPlaygroundDialogMatchingSpansQuery>(
      graphql`
        query ProjectEvaluatorPlaygroundDialogMatchingSpansQuery(
          $projectId: ID!
          $filterCondition: String
          $first: Int!
        ) {
          project: node(id: $projectId) {
            ... on Project {
              spans(
                first: $first
                sort: { col: startTime, dir: desc }
                filterCondition: $filterCondition
              ) {
                edges {
                  span: node {
                    id
                    name
                    spanKind
                    evaluationContext
                  }
                }
                pageInfo {
                  hasNextPage
                }
              }
            }
          }
        }
      `,
      {
        projectId,
        filterCondition: filterCondition.trim() || null,
        first: limit,
      },
      { fetchPolicy: "store-and-network" }
    );
  const spans = data.project?.spans?.edges.map(({ span }) => span) ?? [];
  return (
    <RecordPreviewList
      listLabel="Latest matching spans"
      hasMore={data.project?.spans?.pageInfo.hasNextPage ?? false}
      isLoadingMore={isLoadingMore}
      onLoadMore={() =>
        startLoadMoreTransition(() => {
          setLimit((current) => current + MATCHING_SPAN_PREVIEW_PAGE_SIZE);
        })
      }
    >
      {spans.map((span) => (
        <RecordPreviewCard
          key={span.id}
          name={span.name}
          spanKind={span.spanKind}
          context={span.evaluationContext}
          isExpanded={expandedSpanId === span.id}
          onToggleExpanded={() =>
            setExpandedSpanId(expandedSpanId === span.id ? null : span.id)
          }
        >
          <View padding="size-200">
            <RecordContextViewer context={span.evaluationContext} />
          </View>
        </RecordPreviewCard>
      ))}
    </RecordPreviewList>
  );
}
