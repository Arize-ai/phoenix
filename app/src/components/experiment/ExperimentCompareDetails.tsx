import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  Card,
  Checkbox,
  ColorSwatch,
  CopyToClipboardButton,
  Dialog,
  DialogTrigger,
  Empty,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Popover,
  PopoverArrow,
  ProgressBar,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { JSONBlock } from "@phoenix/components/code";
import { useExperimentColors } from "@phoenix/components/experiment";
import {
  compactResizeHandleCSS,
  resizeHandleCSS,
} from "@phoenix/components/resize";
import { LineClamp } from "@phoenix/components/utility/LineClamp";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useWordColor } from "@phoenix/hooks";
import { calculateAnnotationScorePercentile } from "@phoenix/pages/experiment/utils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import {
  ExperimentCompareDetailsQuery,
  ExperimentCompareDetailsQuery$data,
} from "./__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunMetadata } from "./ExperimentRunMetadata";

export type ExperimentCompareDetailsProps = {
  datasetId: string;
  datasetExampleId: string;
  datasetVersionId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
  defaultSelectedRepetitionNumber?: number;
};

type Experiment = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

type Annotation = ExperimentRun["annotations"]["edges"][number]["annotation"];

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

const SIDEBAR_PANEL_DEFAULT_SIZE = 15;

export function ExperimentCompareDetails({
  datasetId,
  datasetExampleId,
  datasetVersionId,
  baseExperimentId,
  compareExperimentIds,
  defaultSelectedRepetitionNumber,
}: ExperimentCompareDetailsProps) {
  const experimentIds = useMemo(
    () => [baseExperimentId, ...compareExperimentIds],
    [baseExperimentId, compareExperimentIds]
  );
  const data = useLazyLoadQuery<ExperimentCompareDetailsQuery>(
    graphql`
      query ExperimentCompareDetailsQuery(
        $datasetId: ID!
        $datasetExampleId: ID!
        $datasetVersionId: ID!
        $experimentIds: [ID!]!
      ) {
        example: node(id: $datasetExampleId) {
          ... on DatasetExample {
            revision(datasetVersionId: $datasetVersionId) {
              input
              referenceOutput: output
            }
            experimentRuns(experimentIds: $experimentIds, first: 120) {
              edges {
                run: node {
                  id
                  repetitionNumber
                  latencyMs
                  experimentId
                  output
                  error
                  costSummary {
                    total {
                      cost
                      tokens
                    }
                  }
                  annotations {
                    edges {
                      annotation: node {
                        id
                        name
                        label
                        score
                      }
                    }
                  }
                }
              }
            }
          }
        }
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments(filterIds: $experimentIds) {
              edges {
                experiment: node {
                  id
                  name
                  repetitions
                }
              }
            }
            experimentAnnotationSummaries {
              annotationName
              minScore
              maxScore
            }
          }
        }
      }
    `,
    {
      datasetId,
      datasetExampleId,
      datasetVersionId,
      experimentIds,
    }
  );

  const input = data.example.revision?.input;
  const referenceOutput = data.example.revision?.referenceOutput;
  const experimentRuns = data.example.experimentRuns?.edges;
  const experiments = data.dataset.experiments?.edges;
  const annotationSummaries = data.dataset.experimentAnnotationSummaries;

  const experimentsById = useMemo(() => {
    const experimentsById: Record<string, Experiment> = {};
    experiments?.forEach((edge) => {
      experimentsById[edge.experiment.id] = edge.experiment;
    });
    return experimentsById;
  }, [experiments]);

  const experimentRunsByExperimentId = useMemo(() => {
    const experimentRunsByExperimentId =
      experimentRuns?.reduce(
        (acc, run) => {
          acc[run.run.experimentId] = [
            ...(acc[run.run.experimentId] || []),
            run.run,
          ];
          return acc;
        },
        {} as Record<string, ExperimentRun[]>
      ) ?? {};
    experimentIds.forEach((experimentId) => {
      if (!experimentRunsByExperimentId[experimentId]) {
        experimentRunsByExperimentId[experimentId] = [];
      }
    });
    return experimentRunsByExperimentId;
  }, [experimentRuns, experimentIds]);

  return (
    <PanelGroup direction="vertical" autoSaveId="example-compare-panel-group">
      <Panel defaultSize={35}>
        <div
          css={css`
            height: 100%;
          `}
        >
          <View overflow="hidden" padding="size-200" height="100%">
            <Flex direction="row" gap="size-200" flex="1 1 auto" height="100%">
              <Card
                title="Input"
                extra={<CopyToClipboardButton text={JSON.stringify(input)} />}
                height="100%"
                flex={1}
                scrollBody={true}
              >
                <FullSizeJSONBlock value={JSON.stringify(input, null, 2)} />
              </Card>
              <Card
                title="Reference Output"
                extra={
                  <CopyToClipboardButton
                    text={JSON.stringify(referenceOutput)}
                  />
                }
                height="100%"
                flex={1}
                scrollBody={true}
              >
                <FullSizeJSONBlock
                  value={JSON.stringify(referenceOutput, null, 2)}
                />
              </Card>
            </Flex>
          </View>
        </div>
      </Panel>
      <PanelResizeHandle css={resizeHandleCSS} />
      <Panel defaultSize={65}>
        <div
          css={css`
            overflow-y: auto;
            height: 100%;
            box-sizing: border-box;
          `}
        >
          <ExperimentRunOutputs
            key={datasetExampleId + "-" + defaultSelectedRepetitionNumber}
            baseExperimentId={baseExperimentId}
            compareExperimentIds={compareExperimentIds}
            experimentsById={experimentsById}
            experimentRunsByExperimentId={experimentRunsByExperimentId}
            defaultSelectedRepetitionNumber={defaultSelectedRepetitionNumber}
            annotationSummaries={annotationSummaries}
          />
        </div>
      </Panel>
    </PanelGroup>
  );
}

type ExperimentRunSelectionState = {
  experimentId: string;
  runId?: string;
  selected: boolean;
};

export function ExperimentRunOutputs({
  baseExperimentId,
  compareExperimentIds,
  experimentsById,
  experimentRunsByExperimentId,
  defaultSelectedRepetitionNumber,
  annotationSummaries,
}: {
  baseExperimentId: string;
  compareExperimentIds: string[];
  experimentsById: Record<string, Experiment>;
  experimentRunsByExperimentId: Record<string, ExperimentRun[]>;
  defaultSelectedRepetitionNumber?: number;
  annotationSummaries?: AnnotationSummaries;
}) {
  const experimentIds = [baseExperimentId, ...compareExperimentIds];

  const [selectedExperimentRuns, setSelectedExperimentRuns] = useState<
    ExperimentRunSelectionState[]
  >(() =>
    initializeSelectionState(
      experimentIds,
      baseExperimentId,
      experimentRunsByExperimentId,
      defaultSelectedRepetitionNumber
    )
  );

  const updateExperimentSelection = useCallback(
    (experimentId: string, checked: boolean) => {
      setSelectedExperimentRuns((prev) =>
        prev.map((run) =>
          run.experimentId === experimentId
            ? { ...run, selected: checked }
            : run
        )
      );
    },
    []
  );

  const updateRepetitionSelection = useCallback(
    (runId: string, checked: boolean) => {
      setSelectedExperimentRuns((prev) =>
        prev.map((run) =>
          run.runId === runId ? { ...run, selected: checked } : run
        )
      );
    },
    []
  );

  const noRunsSelected = selectedExperimentRuns.every((run) => !run.selected);

  const includeRepetitions = useMemo(() => {
    return Object.values(experimentsById).some(
      (experiment) => experiment.repetitions > 1
    );
  }, [experimentsById]);
  const [isSideBarOpen, setIsSideBarOpen] = useState(true);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  return (
    <PanelGroup direction="horizontal">
      {isSideBarOpen ? (
        <Panel
          defaultSize={SIDEBAR_PANEL_DEFAULT_SIZE}
          ref={sidebarPanelRef}
          collapsible
          id="experiment-compare-details-outputs-sidebar-panel"
          order={1}
          onCollapse={() => setIsSideBarOpen(false)}
        >
          <ExperimentRunOutputsSidebar
            experimentIds={experimentIds}
            experimentsById={experimentsById}
            experimentRunsByExperimentId={experimentRunsByExperimentId}
            selectedExperimentRuns={selectedExperimentRuns}
            updateExperimentSelection={updateExperimentSelection}
            updateRepetitionSelection={updateRepetitionSelection}
            includeRepetitions={includeRepetitions}
          />
        </Panel>
      ) : null}
      {isSideBarOpen ? (
        <PanelResizeHandle css={compactResizeHandleCSS} />
      ) : null}
      <Panel id="experiment-compare-details-outputs-main-panel" order={2}>
        <Flex direction="column" height="100%">
          <View
            paddingX="size-200"
            paddingY="size-100"
            borderBottomColor="dark"
            borderBottomWidth="thin"
            flex="none"
          >
            <Flex direction="row" gap="size-200" alignItems="center">
              <IconButton
                size="S"
                aria-label="Toggle side bar"
                onPress={() => {
                  setIsSideBarOpen(!isSideBarOpen);
                  const sidebarPanel = sidebarPanelRef.current;
                  // expand the panel if it is not the minimum size already
                  if (sidebarPanel) {
                    const size = sidebarPanel.getSize();
                    if (size < SIDEBAR_PANEL_DEFAULT_SIZE) {
                      sidebarPanel.resize(SIDEBAR_PANEL_DEFAULT_SIZE);
                    }
                  }
                }}
              >
                <Icon
                  svg={isSideBarOpen ? <Icons.SlideOut /> : <Icons.SlideIn />}
                />
              </IconButton>
              <Heading>Experiment Runs</Heading>
            </Flex>
          </View>
          {noRunsSelected && <Empty message="No runs selected" />}
          <ul
            css={css`
              flex: 1;
              display: flex;
              flex-direction: row;
              justify-content: flex-start;
              align-items: flex-start;
              flex-wrap: none;
              gap: var(--ac-global-dimension-static-size-200);
              overflow: auto;
              padding: var(--ac-global-dimension-static-size-200);
            `}
          >
            {experimentIds.map((experimentId, experimentIndex) => {
              const experiment = experimentsById[experimentId];
              const experimentRuns = experimentRunsByExperimentId[experimentId];
              const experimentRunsToDisplay = getSelectedExperimentRuns(
                experimentId,
                selectedExperimentRuns,
                experimentRunsByExperimentId
              );
              const renderNoRunCard = shouldRenderNoRunCard(
                experimentId,
                experimentRuns,
                selectedExperimentRuns
              );

              if (renderNoRunCard) {
                return (
                  <li
                    key={experimentId}
                    css={css`
                      // Make them all the same size
                      flex: none;
                    `}
                  >
                    <ExperimentItem
                      experiment={experiment}
                      experimentIndex={experimentIndex}
                      includeRepetitions={includeRepetitions}
                    />
                  </li>
                );
              }

              return experimentRunsToDisplay.map((run) => (
                <li
                  key={run.id}
                  css={css`
                    // Make them all the same size
                    flex: none;
                  `}
                >
                  <ExperimentItem
                    experiment={experiment}
                    experimentRun={run}
                    experimentIndex={experimentIndex}
                    includeRepetitions={includeRepetitions}
                    annotationSummaries={annotationSummaries}
                  />
                </li>
              ));
            })}
          </ul>
        </Flex>
      </Panel>
    </PanelGroup>
  );
}

function ExperimentRunOutputsSidebar({
  experimentIds,
  experimentsById,
  experimentRunsByExperimentId,
  selectedExperimentRuns,
  updateExperimentSelection,
  updateRepetitionSelection,
  includeRepetitions,
}: {
  experimentIds: string[];
  experimentsById: Record<string, Experiment>;
  experimentRunsByExperimentId: Record<string, ExperimentRun[]>;
  selectedExperimentRuns: ExperimentRunSelectionState[];
  updateExperimentSelection: (experimentId: string, checked: boolean) => void;
  updateRepetitionSelection: (runId: string, checked: boolean) => void;
  includeRepetitions: boolean;
}) {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();

  return (
    <div
      css={css`
        flex: none;
        font-size: var(--ac-global-dimension-static-font-size-100);
        color: var(--ac-global-color-grey-700);
        padding: var(--ac-global-dimension-static-size-200);
        overflow: auto;
        height: 100%;
        box-sizing: border-box;
      `}
    >
      <Flex direction="column" gap="size-200">
        {experimentIds.map((experimentId, experimentIndex) => {
          const experiment = experimentsById[experimentId];
          const experimentRuns = experimentRunsByExperimentId[experimentId];
          const allExperimentRunsSelected = areAllExperimentRunsSelected(
            experimentId,
            selectedExperimentRuns
          );
          const someExperimentRunsSelected = areSomeExperimentRunsSelected(
            experimentId,
            selectedExperimentRuns
          );
          return (
            <Fragment key={experimentId}>
              <Checkbox
                isSelected={allExperimentRunsSelected}
                isIndeterminate={
                  someExperimentRunsSelected && !allExperimentRunsSelected
                }
                onChange={(isSelected) =>
                  updateExperimentSelection(experimentId, isSelected)
                }
              >
                <span
                  css={css`
                    flex: none;
                  `}
                >
                  <ColorSwatch
                    color={
                      experimentIndex === 0
                        ? baseExperimentColor
                        : getExperimentColor(experimentIndex - 1)
                    }
                    shape="circle"
                  />
                </span>
                <LineClamp lines={2}>{experiment.name}</LineClamp>
              </Checkbox>
              {includeRepetitions && (
                <View paddingStart="size-500">
                  <Flex direction="column" gap="size-200">
                    {experimentRuns.map((run) => (
                      <Checkbox
                        key={run.id}
                        isSelected={
                          selectedExperimentRuns.find(
                            (runSelection) => runSelection.runId === run.id
                          )?.selected
                        }
                        onChange={(isSelected) =>
                          updateRepetitionSelection(run.id, isSelected)
                        }
                      >
                        repetition {run.repetitionNumber}
                      </Checkbox>
                    ))}
                  </Flex>
                </View>
              )}
            </Fragment>
          );
        })}
      </Flex>
    </div>
  );
}

const experimentItemCSS = css`
  border: 1px solid var(--ac-global-border-color-dark);
  border-radius: var(--ac-global-rounding-medium);
  box-shadow: 0px 8px 8px rgba(0 0 0 / 0.05);
  width: var(--ac-global-dimension-static-size-6000);
  overflow: hidden;
`;

/**
 * Shows a single experiment's output and annotations
 */
export function ExperimentItem({
  experiment,
  experimentRun,
  experimentIndex,
  includeRepetitions,
  annotationSummaries,
}: {
  experiment: Experiment;
  experimentRun?: ExperimentRun;
  experimentIndex: number;
  includeRepetitions: boolean;
  annotationSummaries?: AnnotationSummaries;
}) {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const color =
    experimentIndex === 0
      ? baseExperimentColor
      : getExperimentColor(experimentIndex - 1);

  const hasExperimentResult = experimentRun !== undefined;
  return (
    <div css={experimentItemCSS}>
      <Flex direction="column">
        <View paddingX="size-200" paddingTop="size-200" flex="none">
          <Flex direction="row" gap="size-100" alignItems="center">
            <span
              css={css`
                flex: none;
              `}
            >
              <ColorSwatch color={color} shape="circle" />
            </span>
            <Heading
              weight="heavy"
              level={3}
              css={css`
                min-width: 0;
              `}
            >
              <Truncate maxWidth="100%">{experiment?.name ?? ""}</Truncate>
            </Heading>
            {includeRepetitions && experimentRun && (
              <>
                <Icon svg={<Icons.ChevronRight />} />
                <Heading weight="heavy" level={3}>
                  repetition&nbsp;{experimentRun.repetitionNumber}
                </Heading>
              </>
            )}
          </Flex>
        </View>
        {!hasExperimentResult ? (
          <Empty message="No Runs" />
        ) : (
          <>
            <View
              paddingX="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              flex="none"
            >
              <ExperimentRunMetadata {...experimentRun} />
            </View>
            <View
              paddingX="size-100"
              paddingBottom="size-100"
              borderBottomColor="grey-300"
              borderBottomWidth="thin"
            >
              <ExperimentRunAnnotations
                experimentRun={experimentRun}
                annotationSummaries={annotationSummaries}
              />
            </View>
            <View flex={1}>
              {experimentRun.error ? (
                <View padding="size-200">{experimentRun.error}</View>
              ) : (
                <JSONBlockWithCopy value={experimentRun.output} />
              )}
            </View>
          </>
        )}
      </Flex>
    </div>
  );
}

/**
 * Wrapper to make JSONBlock fill available vertical and horizontal space in this dialog
 */
function FullSizeJSONBlock({ value }: { value: string }) {
  return (
    <div
      css={css`
        height: 100%;
        width: 100%;
        & .cm-theme, // CodeMirror wrapper component
        & .cm-editor {
          height: 100%;
          width: 100%;
        }
      `}
    >
      <JSONBlock value={value} />
    </div>
  );
}

function JSONBlockWithCopy({ value }: { value: unknown }) {
  const strValue = JSON.stringify(value, null, 2);
  return (
    <div
      css={css`
        position: relative;
        height: 100%;
        & button {
          position: absolute;
          top: var(--ac-global-dimension-size-100);
          right: var(--ac-global-dimension-size-100);
          z-index: 10000;
          display: none;
        }
        &:hover button {
          display: block;
        }
      `}
    >
      <CopyToClipboardButton text={strValue} />
      <JSONBlock value={strValue} />
    </div>
  );
}

export function ExperimentRunAnnotations({
  experimentRun,
  annotationSummaries,
}: {
  experimentRun: ExperimentRun;
  annotationSummaries?: AnnotationSummaries;
}) {
  return (
    <ul
      css={css`
        display: grid;
        grid-template-columns:
          minmax(100px, max-content) minmax(32px, max-content)
          minmax(150px, 1fr);
        column-gap: var(--ac-global-dimension-size-200);
      `}
    >
      {annotationSummaries?.map((annotationSummary) => {
        const annotation = experimentRun.annotations?.edges.find(
          (edge) => edge.annotation.name === annotationSummary.annotationName
        )?.annotation;
        return annotation ? (
          <li
            key={annotationSummary.annotationName}
            css={css`
              height: var(--ac-global-dimension-size-350);
              display: grid;
              grid-template-columns: subgrid;
              grid-column: 1 / -1;
            `}
          >
            <ExperimentRunAnnotation
              annotation={annotation}
              annotationSummary={annotationSummary}
            />
          </li>
        ) : (
          // placeholder to ensure alignment when some experiments are missing annotations
          <li
            key={annotationSummary.annotationName}
            aria-hidden="true"
            css={css`
              height: var(--ac-global-dimension-size-350);
              grid-column: 1 / -1;
            `}
          />
        );
      })}
    </ul>
  );
}

function ExperimentRunAnnotationButton({
  annotation,
  annotationSummary,
}: {
  annotation: Annotation;
  annotationSummary: AnnotationSummaries[number];
}) {
  const annotationColor = useWordColor(annotation.name);
  const labelValue =
    annotation.score != null
      ? formatFloat(annotation.score)
      : annotation.label || "--";

  return (
    <AriaButton // using AriaButton to ensure the popover works
      className="button--reset"
      css={css`
        cursor: pointer;
        padding: var(--ac-global-dimension-size-50)
          var(--ac-global-dimension-size-100);
        border-radius: var(--ac-global-rounding-small);
        width: 100%;
        display: grid;
        grid-template-columns: subgrid;
        grid-column: 1 / -1;
        &:hover {
          background-color: var(--ac-global-color-grey-200);
        }
      `}
    >
      <Flex
        direction="row"
        gap="size-100"
        alignItems="center"
        justifySelf="start"
        minWidth={0}
        maxWidth="100%"
      >
        <span
          css={css`
            flex: none;
          `}
        >
          <ColorSwatch color={annotationColor} shape="circle" />
        </span>

        <Text weight="heavy" color="inherit" minWidth={0}>
          <Truncate maxWidth="100%">{annotation.name}</Truncate>
        </Text>
      </Flex>

      <Text fontFamily="mono" justifySelf="start" maxWidth="100%">
        <Truncate maxWidth="100%">{labelValue}</Truncate>
      </Text>

      {annotation.score != null ? (
        <ProgressBar
          css={css`
            align-self: center;
            --mod-barloader-fill-color: ${annotationColor};
          `}
          value={calculateAnnotationScorePercentile(
            annotation.score,
            annotationSummary.minScore,
            annotationSummary.maxScore
          )}
          height="var(--ac-global-dimension-size-50)"
          width="100%"
          aria-label={`${annotation.name} score`}
        />
      ) : (
        <div />
      )}
    </AriaButton>
  );
}

function ExperimentRunAnnotation({
  annotation,
  annotationSummary,
}: {
  annotation: Annotation;
  annotationSummary: AnnotationSummaries[number];
}) {
  return (
    <DialogTrigger>
      <ExperimentRunAnnotationButton
        annotation={annotation}
        annotationSummary={annotationSummary}
      />
      <Popover placement="top">
        <PopoverArrow />
        <Dialog style={{ width: 400 }}>
          <View padding="size-200">
            <AnnotationDetailsContent annotation={annotation} />
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function initializeSelectionState(
  experimentIds: string[],
  baseExperimentId: string,
  experimentRunsByExperimentId: Record<string, ExperimentRun[]>,
  defaultSelectedRepetitionNumber?: number
): ExperimentRunSelectionState[] {
  return experimentIds.flatMap((experimentId) => {
    const runs = experimentRunsByExperimentId[experimentId];
    if (!runs.length) {
      return [
        {
          experimentId,
          selected: true,
        } as ExperimentRunSelectionState,
      ];
    }
    return runs.map((run) => {
      return {
        experimentId,
        runId: run.id,
        selected:
          experimentId === baseExperimentId &&
          defaultSelectedRepetitionNumber !== undefined
            ? run.repetitionNumber === defaultSelectedRepetitionNumber
            : true,
      };
    });
  });
}
function areAllExperimentRunsSelected(
  experimentId: string,
  selectedExperimentRuns: ExperimentRunSelectionState[]
): boolean {
  return selectedExperimentRuns
    .filter((run) => run.experimentId === experimentId)
    .every((run) => run.selected);
}

function areSomeExperimentRunsSelected(
  experimentId: string,
  selectedExperimentRuns: ExperimentRunSelectionState[]
): boolean {
  return selectedExperimentRuns
    .filter((run) => run.experimentId === experimentId)
    .some((run) => run.selected);
}

function getSelectedExperimentRuns(
  experimentId: string,
  selectedExperimentRuns: ExperimentRunSelectionState[],
  experimentRunsByExperimentId: Record<string, ExperimentRun[]>
): ExperimentRun[] {
  const experimentRuns = experimentRunsByExperimentId[experimentId];
  return selectedExperimentRuns
    .filter((run) => run.experimentId === experimentId && run.selected)
    .flatMap(
      (run) =>
        experimentRuns.find(
          (experimentRun) => experimentRun.id === run.runId
        ) ?? []
    );
}

function shouldRenderNoRunCard(
  experimentId: string,
  experimentRuns: ExperimentRun[],
  selectedExperimentRuns: ExperimentRunSelectionState[]
): boolean {
  const experimentDidRun = experimentRuns.length > 0;
  const isExperimentSelected =
    selectedExperimentRuns.find((run) => run.experimentId === experimentId)
      ?.selected ?? false;

  return !experimentDidRun && isExperimentSelected;
}
