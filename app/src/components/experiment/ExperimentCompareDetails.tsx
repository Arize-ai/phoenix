import { Fragment, useCallback, useMemo, useRef, useState } from "react";
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

import {
  ExperimentCompareDetailsQuery,
  ExperimentCompareDetailsQuery$data,
} from "./__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentAnnotationButton } from "./ExperimentAnnotationButton";
import { ExperimentRunMetadata } from "./ExperimentRunMetadata";

export type ExperimentCompareDetailsProps = {
  datasetId: string;
  datasetExampleId: string;
  datasetVersionId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
};

type Experiment = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

const SIDEBAR_PANEL_DEFAULT_SIZE = 15;

export function ExperimentCompareDetails({
  datasetId,
  datasetExampleId,
  datasetVersionId,
  baseExperimentId,
  compareExperimentIds,
}: ExperimentCompareDetailsProps) {
  const experimentIds = useMemo(
    () => [baseExperimentId, ...compareExperimentIds],
    [baseExperimentId, compareExperimentIds]
  );
  const exampleData = useLazyLoadQuery<ExperimentCompareDetailsQuery>(
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

  const input = exampleData.example.revision?.input;
  const referenceOutput = exampleData.example.revision?.referenceOutput;
  const experimentRuns = exampleData.example.experimentRuns?.edges;
  const experiments = exampleData.dataset.experiments?.edges;

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
            key={datasetExampleId}
            baseExperimentId={baseExperimentId}
            compareExperimentIds={compareExperimentIds}
            experimentsById={experimentsById}
            experimentRunsByExperimentId={experimentRunsByExperimentId}
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

function ExperimentRunOutputs({
  baseExperimentId,
  compareExperimentIds,
  experimentsById,
  experimentRunsByExperimentId,
}: {
  baseExperimentId: string;
  compareExperimentIds: string[];
  experimentsById: Record<string, Experiment>;
  experimentRunsByExperimentId: Record<string, ExperimentRun[]>;
}) {
  const experimentIds = [baseExperimentId, ...compareExperimentIds];

  const [selectedExperimentRuns, setSelectedExperimentRuns] = useState<
    ExperimentRunSelectionState[]
  >(() =>
    initializeSelectionState(experimentIds, experimentRunsByExperimentId)
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
      <Panel>
        <View
          paddingX="size-200"
          paddingY="size-100"
          borderBottomColor="dark"
          borderBottomWidth="thin"
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
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            flex-wrap: none;
            gap: var(--ac-global-dimension-static-size-200);
            overflow-x: auto;
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
                />
              </li>
            ));
          })}
        </ul>
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
        width: 340px;
        flex: none;
        font-size: var(--ac-global-dimension-static-font-size-100);
        color: var(--ac-global-color-grey-700);
        padding: var(--ac-global-dimension-static-size-200);
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
  border-radius: var(--ac-global-rounding-small);
  box-shadow: 0px 8px 8px rgba(0 0 0 / 0.05);
  width: var(--ac-global-dimension-static-size-6000);
`;

/**
 * Shows a single experiment's output and annotations
 */
function ExperimentItem({
  experiment,
  experimentRun,
  experimentIndex,
  includeRepetitions,
}: {
  experiment: Experiment;
  experimentRun?: ExperimentRun;
  experimentIndex: number;
  includeRepetitions: boolean;
}) {
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const color =
    experimentIndex === 0
      ? baseExperimentColor
      : getExperimentColor(experimentIndex - 1);

  const hasExperimentResult = experimentRun !== undefined;
  return (
    <div css={experimentItemCSS}>
      <View paddingX="size-200" paddingTop="size-200">
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
          <div
            css={css`
              border-bottom: 1px solid var(--ac-global-border-color-default);
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-100);
            `}
          >
            <View paddingX="size-200" paddingTop="size-100">
              <ExperimentRunMetadata {...experimentRun} />
            </View>
            <ul
              css={css`
                padding: 0 var(--ac-global-dimension-size-100)
                  var(--ac-global-dimension-size-100)
                  var(--ac-global-dimension-size-100);
              `}
            >
              {experimentRun.annotations?.edges.map((edge) => (
                <li key={edge.annotation.id}>
                  <DialogTrigger>
                    <ExperimentAnnotationButton annotation={edge.annotation} />
                    <Popover placement="top">
                      <PopoverArrow />
                      <Dialog style={{ width: 400 }}>
                        <View padding="size-200">
                          <AnnotationDetailsContent
                            annotation={edge.annotation}
                          />
                        </View>
                      </Dialog>
                    </Popover>
                  </DialogTrigger>
                </li>
              ))}
            </ul>
          </div>
          <View>
            {experimentRun.error ? (
              <View padding="size-200">{experimentRun.error}</View>
            ) : (
              <JSONBlockWithCopy value={experimentRun.output} />
            )}
          </View>
        </>
      )}
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

function initializeSelectionState(
  experimentIds: string[],
  experimentRunsByExperimentId: Record<string, ExperimentRun[]>
): ExperimentRunSelectionState[] {
  return experimentIds.flatMap((experimentId) => {
    const runs = experimentRunsByExperimentId[experimentId];
    if (!runs.length) {
      return {
        experimentId,
        selected: true,
      };
    }
    return runs.map((run) => ({
      experimentId,
      runId: run.id,
      selected: true,
    }));
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
