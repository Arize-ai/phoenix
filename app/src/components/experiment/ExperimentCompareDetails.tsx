import { Fragment, useMemo, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { range } from "lodash";
import { css } from "@emotion/react";

import {
  Button,
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
  Menu,
  MenuItem,
  MenuTrigger,
  MenuTriggerPlaceholder,
  Popover,
  PopoverArrow,
  ProgressBar,
  SelectChevronUpDownIcon,
  Text,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
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
  type AnnotationSummaries,
  areAllExperimentRunsSelected,
  areSomeExperimentRunsSelected,
  type Experiment,
  ExperimentCompareDetailsProvider,
  type ExperimentRepetition,
  type ExperimentRun,
  getAnnotationValue,
  useExperimentCompareDetailsContext,
} from "@phoenix/contexts/ExperimentCompareContext";
import { useWordColor } from "@phoenix/hooks";
import { calculateAnnotationScorePercentile } from "@phoenix/pages/experiment/utils";
import { floatFormatter, formatFloat } from "@phoenix/utils/numberFormatUtils";

import { ExperimentCompareDetailsQuery } from "./__generated__/ExperimentCompareDetailsQuery.graphql";
import { ExperimentRunMetadata } from "./ExperimentRunMetadata";

export type ExperimentCompareDetailsProps = {
  datasetId: string;
  datasetExampleId: string;
  datasetVersionId: string;
  baseExperimentId: string;
  compareExperimentIds: string[];
  defaultSelectedRepetitionNumber?: number;
  openTraceDialog: (traceId: string, projectId: string, title: string) => void;
};

type Annotation = ExperimentRun["annotations"]["edges"][number]["annotation"];

const SIDEBAR_PANEL_DEFAULT_SIZE = 25;

export function ExperimentCompareDetails({
  datasetId,
  datasetExampleId,
  datasetVersionId,
  baseExperimentId,
  compareExperimentIds,
  defaultSelectedRepetitionNumber,
  openTraceDialog,
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
                  trace {
                    traceId
                    projectId
                  }
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
                        trace {
                          traceId
                          projectId
                        }
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

  const experimentRepetitionsByExperimentId = useMemo(() => {
    const experimentRepetitionsByExperimentId: Record<
      string,
      ExperimentRepetition[]
    > = {};
    experimentIds.forEach((experimentId) => {
      experimentRepetitionsByExperimentId[experimentId] = [];
      const experiment = experimentsById[experimentId];
      if (!experiment) {
        return;
      }
      range(experiment.repetitions).forEach((repetitionIndex) => {
        const repetitionNumber = repetitionIndex + 1;
        const experimentRun = experimentRuns?.find(
          (run) =>
            run.run.experimentId === experimentId &&
            run.run.repetitionNumber === repetitionNumber
        );
        if (!experimentRun) {
          experimentRepetitionsByExperimentId[experimentId].push({
            experimentId,
            repetitionNumber,
          });
        } else {
          experimentRepetitionsByExperimentId[experimentId].push({
            experimentId,
            repetitionNumber,
            experimentRun: experimentRun.run,
          });
        }
      });
    });
    return experimentRepetitionsByExperimentId;
  }, [experimentRuns, experimentIds, experimentsById]);

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
          <ExperimentCompareDetailsProvider
            baseExperimentId={baseExperimentId}
            compareExperimentIds={compareExperimentIds}
            experimentsById={experimentsById}
            experimentRepetitionsByExperimentId={
              experimentRepetitionsByExperimentId
            }
            annotationSummaries={annotationSummaries ?? []}
            includeRepetitions={Object.values(experimentsById).some(
              (experiment) => experiment.repetitions > 1
            )}
            openTraceDialog={openTraceDialog}
            defaultSelectedRepetitionNumber={defaultSelectedRepetitionNumber}
          >
            <ExperimentRunOutputs />
          </ExperimentCompareDetailsProvider>
        </div>
      </Panel>
    </PanelGroup>
  );
}

export function ExperimentRunOutputs() {
  const {
    sortedExperimentRepetitions,
    noRunsSelected,
    experimentsById,
    baseExperimentId,
    compareExperimentIds,
  } = useExperimentCompareDetailsContext();

  const experimentIds = useMemo(
    () => [baseExperimentId, ...compareExperimentIds],
    [baseExperimentId, compareExperimentIds]
  );

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
          style={{
            minWidth: 300,
          }}
        >
          <ExperimentRunOutputsSidebar />
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
            {sortedExperimentRepetitions.map(
              ({ experimentId, experimentRepetitions }) => {
                const experiment = experimentsById[experimentId];
                const experimentIndex = experimentIds.indexOf(experimentId);
                if (!experiment) {
                  return null;
                }
                return experimentRepetitions.map((repetition) => {
                  return (
                    <ExperimentListItemIfSelected
                      key={`${experimentId}-${repetition.repetitionNumber}`}
                      experiment={experiment}
                      experimentRepetition={repetition}
                      experimentIndex={experimentIndex}
                    />
                  );
                });
              }
            )}
          </ul>
        </Flex>
      </Panel>
    </PanelGroup>
  );
}

const ExperimentListItemIfSelected = ({
  experiment,
  experimentRepetition,
  experimentIndex,
}: {
  experiment: Experiment;
  experimentRepetition: ExperimentRepetition;
  experimentIndex: number;
}) => {
  const { selectedExperimentRepetitions } =
    useExperimentCompareDetailsContext();
  const isSelected = useMemo(
    () =>
      selectedExperimentRepetitions.some(
        (runSelection) =>
          runSelection.experimentId === experiment.id &&
          runSelection.repetitionNumber ===
            experimentRepetition.repetitionNumber &&
          runSelection.selected
      ),
    [
      selectedExperimentRepetitions,
      experiment.id,
      experimentRepetition.repetitionNumber,
    ]
  );

  if (!isSelected) {
    return null;
  }

  return (
    <li
      css={css`
        flex: none;
      `}
    >
      <ExperimentItem
        experiment={experiment}
        experimentRepetition={experimentRepetition}
        experimentIndex={experimentIndex}
      />
    </li>
  );
};

function ExperimentRunOutputsSidebar() {
  const {
    experimentsById,
    annotationSummaries,
    includeRepetitions,
    baseExperimentId,
    compareExperimentIds,
    sortedExperimentRepetitions,
    selectedExperimentRepetitions,
    updateExperimentSelection,
    updateRepetitionSelection,
    toggleAllRepetitionsSelection,
    selectedAnnotation,
    setSelectedAnnotation,
    toggleSortDirection,
  } = useExperimentCompareDetailsContext();

  const experimentIds = useMemo(
    () => [baseExperimentId, ...compareExperimentIds],
    [baseExperimentId, compareExperimentIds]
  );

  const { baseExperimentColor, getExperimentColor } = useExperimentColors();

  const allRepetitionsSelected = useMemo(
    () => selectedExperimentRepetitions.every((run) => run.selected),
    [selectedExperimentRepetitions]
  );
  const someRepetitionsSelected = useMemo(
    () => selectedExperimentRepetitions.some((run) => run.selected),
    [selectedExperimentRepetitions]
  );

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
      <Flex
        direction="row"
        gap="size-200"
        alignItems="center"
        justifyContent="space-between"
      >
        <Checkbox
          isSelected={allRepetitionsSelected}
          isIndeterminate={someRepetitionsSelected && !allRepetitionsSelected}
          onChange={(checked) => toggleAllRepetitionsSelection(checked)}
        >
          <Text>Select all</Text>
        </Checkbox>
        {annotationSummaries.length > 0 && (
          <Flex
            direction="row"
            alignItems="center"
            css={css`
              overflow: hidden;
              padding: var(--ac-global-dimension-size-25);
            `}
          >
            <MenuTrigger
              css={css`
                overflow: hidden;
                padding: var(
                  --ac-global-dimension-size-25
                ); // keep focus ring visible
              `}
            >
              <Button variant="quiet" size="S">
                {selectedAnnotation ? (
                  <Text>{selectedAnnotation}</Text>
                ) : (
                  <MenuTriggerPlaceholder>No annotation</MenuTriggerPlaceholder>
                )}
                <SelectChevronUpDownIcon />
              </Button>
              <Popover>
                <Menu
                  items={annotationSummaries}
                  selectionMode="single"
                  selectedKeys={selectedAnnotation ? [selectedAnnotation] : []}
                  onSelectionChange={(keys) => {
                    if (keys === "all") {
                      return;
                    }
                    setSelectedAnnotation(keys.values().next().value as string);
                  }}
                  css={css`
                    font-size: var(--ac-global-font-size-s);
                  `}
                >
                  {(annotation) => (
                    <MenuItem
                      key={annotation.annotationName}
                      id={annotation.annotationName}
                    >
                      {annotation.annotationName}
                    </MenuItem>
                  )}
                </Menu>
              </Popover>
            </MenuTrigger>
            {selectedAnnotation ? (
              <IconButton
                size="S"
                aria-label="Change sort direction"
                onPress={toggleSortDirection}
                css={css`
                  flex: none;
                `}
              >
                <Icon svg={<Icons.ArrowUpDown />} />
              </IconButton>
            ) : (
              <div // placeholder to prevent layout shift when annotation is selected
                css={css`
                  width: 30px;
                  height: 30px;
                  flex: none;
                `}
              />
            )}
          </Flex>
        )}
      </Flex>
      {sortedExperimentRepetitions.map(
        ({ experimentId, experimentRepetitions }) => {
          const experiment = experimentsById[experimentId];
          const experimentIndex = experimentIds.indexOf(experimentId);
          const allExperimentRunsSelected = areAllExperimentRunsSelected(
            experimentId,
            selectedExperimentRepetitions
          );
          const someExperimentRunsSelected = areSomeExperimentRunsSelected(
            experimentId,
            selectedExperimentRepetitions
          );
          const annotationValue = selectedAnnotation
            ? getAnnotationValue(experimentRepetitions[0], selectedAnnotation)
            : null;
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
                <Flex
                  direction="row"
                  gap="size-200"
                  alignItems="center"
                  justifyContent="space-between"
                  width="100%"
                  minHeight={30}
                  marginY="size-25"
                  css={css`
                    overflow: hidden;
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <span
                      css={css`
                        flex: none;
                        padding-left: var(--ac-global-dimension-size-50);
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
                  </Flex>
                  {!includeRepetitions && selectedAnnotation && (
                    <Text
                      fontFamily="mono"
                      css={css`
                        overflow: hidden;
                        max-width: 50%;
                      `}
                    >
                      <Truncate maxWidth="100%">
                        {annotationValue?.score != null
                          ? floatFormatter(annotationValue.score)
                          : annotationValue?.label || "--"}
                      </Truncate>
                    </Text>
                  )}
                </Flex>
              </Checkbox>

              {includeRepetitions && (
                <ExperimentRepetitionsSidebarItems
                  experiment={experiment}
                  experimentRepetitions={experimentRepetitions}
                  updateRepetitionSelection={(repetitionNumber, isSelected) =>
                    updateRepetitionSelection(
                      experimentId,
                      repetitionNumber,
                      isSelected
                    )
                  }
                />
              )}
            </Fragment>
          );
        }
      )}
    </div>
  );
}

function ExperimentRepetitionsSidebarItems({
  experiment,
  experimentRepetitions,
  updateRepetitionSelection,
}: {
  experiment: Experiment;
  experimentRepetitions: ExperimentRepetition[];
  updateRepetitionSelection: (
    repetitionNumber: number,
    isSelected: boolean
  ) => void;
}) {
  const { selectedExperimentRepetitions, selectedAnnotation } =
    useExperimentCompareDetailsContext();
  return (
    <View paddingStart="size-300">
      <Flex direction="column">
        {experimentRepetitions.map((repetition) => {
          const selectedAnnotationValue = selectedAnnotation
            ? getAnnotationValue(repetition, selectedAnnotation)
            : null;
          const repetitionDidNotRun = !repetition.experimentRun;
          return (
            <Checkbox
              key={repetition.repetitionNumber}
              isSelected={
                selectedExperimentRepetitions.find(
                  (runSelection) =>
                    runSelection.experimentId === experiment.id &&
                    runSelection.repetitionNumber ===
                      repetition.repetitionNumber
                )?.selected
              }
              onChange={(isSelected) =>
                updateRepetitionSelection(
                  repetition.repetitionNumber,
                  isSelected
                )
              }
            >
              <Flex
                direction="row"
                gap="size-200"
                alignItems="center"
                justifyContent="space-between"
                width="100%"
                minHeight={30}
                css={css`
                  overflow: hidden;
                  color: ${repetitionDidNotRun
                    ? "var(--ac-global-color-grey-500)"
                    : "inherit"};
                `}
              >
                <Text>repetition&nbsp;{repetition.repetitionNumber}</Text>
                {selectedAnnotation && (
                  <Text
                    fontFamily="mono"
                    minWidth={0}
                    color={repetitionDidNotRun ? "grey-500" : "inherit"}
                  >
                    {repetitionDidNotRun ? (
                      "Not run"
                    ) : (
                      <Truncate maxWidth="100%">
                        {selectedAnnotationValue?.score != null
                          ? floatFormatter(selectedAnnotationValue.score)
                          : selectedAnnotationValue?.label || "--"}
                      </Truncate>
                    )}
                  </Text>
                )}
              </Flex>
            </Checkbox>
          );
        })}
      </Flex>
    </View>
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
  experimentRepetition,
  experimentIndex,
}: {
  experiment: Experiment;
  experimentRepetition: ExperimentRepetition;
  experimentIndex: number;
}) {
  const { includeRepetitions, openTraceDialog } =
    useExperimentCompareDetailsContext();
  const { baseExperimentColor, getExperimentColor } = useExperimentColors();
  const color =
    experimentIndex === 0
      ? baseExperimentColor
      : getExperimentColor(experimentIndex - 1);

  const experimentRunOutputStr = useMemo(
    () =>
      experimentRepetition.experimentRun
        ? JSON.stringify(experimentRepetition.experimentRun.output, null, 2)
        : undefined,
    [experimentRepetition]
  );

  const traceId = experimentRepetition?.experimentRun?.trace?.traceId;
  const projectId = experimentRepetition?.experimentRun?.trace?.projectId;
  const hasTrace = traceId != null && projectId != null;
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
            {includeRepetitions && (
              <>
                <Icon svg={<Icons.ChevronRight />} />
                <Heading weight="heavy" level={3}>
                  repetition&nbsp;{experimentRepetition.repetitionNumber}
                </Heading>
              </>
            )}
            <div
              css={css`
                margin-left: auto;
                padding-left: var(--ac-global-dimension-size-100);
              `}
            >
              <Flex direction="row" gap="size-100">
                {hasTrace && (
                  <TooltipTrigger>
                    <IconButton
                      size="S"
                      aria-label="View run trace"
                      onPress={() => {
                        openTraceDialog(
                          traceId,
                          projectId,
                          "Experiment Run Trace"
                        );
                      }}
                    >
                      <Icon svg={<Icons.Trace />} />
                    </IconButton>
                    <Tooltip>View run trace</Tooltip>
                  </TooltipTrigger>
                )}
                {experimentRunOutputStr &&
                  !experimentRepetition.experimentRun?.error && (
                    <CopyToClipboardButton text={experimentRunOutputStr} />
                  )}
              </Flex>
            </div>
          </Flex>
        </View>
        {!experimentRepetition?.experimentRun ? (
          <Empty message="Did not run" />
        ) : (
          <>
            <View
              paddingX="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              flex="none"
            >
              <ExperimentRunMetadata {...experimentRepetition.experimentRun} />
            </View>
            <View
              paddingX="size-100"
              paddingBottom="size-100"
              borderBottomColor="grey-300"
              borderBottomWidth="thin"
            >
              <ExperimentRunAnnotations
                experimentRun={experimentRepetition.experimentRun}
              />
            </View>
            <View flex={1}>
              {experimentRepetition.experimentRun.error ? (
                <View padding="size-200">
                  {experimentRepetition.experimentRun.error}
                </View>
              ) : (
                <JSONBlock value={experimentRunOutputStr} />
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

export function ExperimentRunAnnotations({
  experimentRun,
}: {
  experimentRun: ExperimentRun;
}) {
  const { annotationSummaries } = useExperimentCompareDetailsContext();
  return (
    <ul
      css={css`
        display: grid;
        grid-template-columns:
          minmax(100px, max-content) minmax(32px, max-content)
          minmax(150px, 1fr) min-content;
        column-gap: var(--ac-global-dimension-size-100);
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
        grid-column: 1 / -2;
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
          <AnnotationColorSwatch annotationName={annotation.name} />
        </span>

        <Text color="inherit" minWidth={0}>
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
        <div /> // placeholder for grid layout
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
  const { openTraceDialog } = useExperimentCompareDetailsContext();
  const traceId = annotation.trace?.traceId;
  const projectId = annotation.trace?.projectId;
  const hasTrace = traceId != null && projectId != null;
  return (
    <>
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
      {hasTrace ? (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label="View evaluation trace"
            onPress={() => {
              openTraceDialog(
                traceId,
                projectId,
                `Evaluator Trace: ${annotation.name}`
              );
            }}
          >
            <Icon svg={<Icons.Trace />} />
          </IconButton>
          <Tooltip>View evaluation trace</Tooltip>
        </TooltipTrigger>
      ) : (
        <div /> // placeholder for grid layout
      )}
    </>
  );
}
