import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Pressable } from "react-aria-components";
import { shallow } from "zustand/shallow";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Alert,
  Button,
  Counter,
  Dialog,
  DialogTrigger,
  ExpandableContent,
  Flex,
  Icon,
  IconButton,
  Icons,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  Loading,
  NumberField,
  PopoverArrow,
  Text,
  TextField,
  Input,
  Label,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import {
  AnnotationScoreText,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { JSONBlock } from "@phoenix/components/code";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { inlineDividerCSS } from "@phoenix/components/core/styles";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { CellTop } from "@phoenix/components/table";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { PlaygroundErrorWrap } from "../PlaygroundErrorWrap";
import type {
  CalibrationExample,
  CalibrationPrediction,
  CalibrationResult,
  CalibrationRun,
  ExpectedOutput,
  ExpectedVerdict,
  SlotExpectations,
} from "./calibration";
import { getExpectedOutputIssue, getExpectedVerdict } from "./calibration";
import { CalibrationResultsTable } from "./CalibrationResultsTable";
import { CalibrationSelect } from "./CalibrationSelect";
import type { SlotId, SlotOutput, SlotSnapshot } from "./evaluatorSlotTypes";
import { getSlotIndex } from "./evaluatorSlotTypes";

const NO_VALUE = "—";

/** Retain only presentation data. Action handlers always come from the current
 * workspace, so the loading snapshot cannot execute or save against old data. */
export function CalibrationResults(
  props: ComponentProps<typeof CalibrationResultsContent>
) {
  const nextSnapshot = {
    isReady: !props.isLoading,
    examples: props.examples,
    sampleSize: props.sampleSize,
    runs: props.runs,
    slots: props.slots,
    visibleSlotIds: props.visibleSlotIds,
    expected: props.expected,
    filter: props.filter,
    staleSlots: props.staleSlots,
    isRunning: props.isRunning,
    runnableSlots: props.runnableSlots,
  };
  const [snapshot, setSnapshot] = useState(nextSnapshot);
  if (!props.isLoading && !shallow(snapshot, nextSnapshot)) {
    setSnapshot(nextSnapshot);
  }
  const { isReady, ...displayed } = props.isLoading ? snapshot : nextSnapshot;
  const isShowingPreviousSample = props.isLoading && isReady;
  return (
    <div css={resultsSnapshotCSS}>
      <div inert={props.isLoading} css={resultsContentCSS}>
        <CalibrationResultsContent {...props} {...displayed} />
      </div>
      {isShowingPreviousSample ? (
        <div css={loadingOverlayCSS} role="status">
          <Flex direction="column" alignItems="center" gap="size-100">
            <ProgressCircle isIndeterminate aria-label="Loading sample" />
            <Text weight="heavy">Loading sample…</Text>
            <Text size="S">Previous results shown · review paused</Text>
          </Flex>
        </div>
      ) : null}
    </div>
  );
}

const resultsSnapshotCSS = css`
  position: relative;
  height: 100%;
  min-height: 0;
`;
const resultsContentCSS = css`
  position: relative;
  z-index: 0;
  height: 100%;
  min-height: 0;
`;
const loadingOverlayCSS = css`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--global-background-color-default) 80%,
    transparent
  );
`;

function CalibrationResultsContent({
  examples,
  sampleSize,
  isLoading,
  runs,
  slots,
  visibleSlotIds,
  expected,
  filter,
  onFilterChange,
  onReview,
  isRunning,
  runnableSlots,
  onRunSlot,
  onRunExample,
  savingId,
  reviewError,
  staleSlots,
  onRetryReview,
  onReloadSample,
}: {
  examples: CalibrationExample[];
  sampleSize: number;
  isLoading: boolean;
  runs: Partial<Record<SlotId, CalibrationRun>>;
  slots: Partial<Record<SlotId, SlotSnapshot>>;
  visibleSlotIds: SlotId[];
  expected: SlotExpectations;
  filter: string;
  onFilterChange: (filter: string) => void;
  onReview: (
    example: CalibrationExample,
    slot: SlotId,
    output: ExpectedOutput | null
  ) => Promise<UIOperationResult>;
  /** Any slot is executing; every play control waits for it to finish. */
  isRunning: boolean;
  /** Slots whose draft is complete enough to execute. */
  runnableSlots: SlotId[];
  /** Run one evaluator over the whole sample (the column's play button). */
  onRunSlot: (slot: SlotId) => void;
  /** Run every evaluator on one example (the row's play button). */
  onRunExample: (exampleId: string) => void;
  savingId: string | null;
  reviewError: string | null;
  staleSlots: string[];
  onRetryReview: () => void;
  onReloadSample: () => void;
}) {
  const positions = new Map(
    examples.map((example, index) => [example.id, index + 1])
  );
  const selectedOutput = (slot: SlotId) =>
    slots[slot]?.outputNames.find(
      (output) => output.name === slots[slot]?.selectedOutputName
    );
  const verdictFor = (slot: SlotId, example: CalibrationExample) =>
    getExpectedVerdict({
      prediction: runs[slot]?.predictions[example.id],
      expected: expected[slot]?.[example.id],
      output: selectedOutput(slot),
    });
  const views = [
    { id: "all", label: "All", examples },
    {
      id: "missing-expected",
      label: "Missing expected",
      examples: examples.filter((example) =>
        visibleSlotIds.some((slot) => !expected[slot]?.[example.id])
      ),
    },
    {
      id: "errors",
      label: "Errors",
      examples: examples.filter((example) =>
        visibleSlotIds.some(
          (slot) => runs[slot]?.predictions[example.id]?.status === "error"
        )
      ),
    },
    {
      // Anything the expectation can't be squared with: a result that differs
      // from it, or an expectation the output config can no longer produce.
      id: "disagreements",
      label: "Mismatches",
      examples: examples.filter((example) =>
        visibleSlotIds.some((slot) => {
          const verdict = verdictFor(slot, example);
          return verdict === "mismatch" || verdict === "invalid";
        })
      ),
    },
  ];
  const activeView = views.find((view) => view.id === filter) ?? views[0];
  const canRunRows =
    !isLoading &&
    !isRunning &&
    visibleSlotIds.length > 0 &&
    visibleSlotIds.every((slot) => runnableSlots.includes(slot));
  const columns: ColumnDef<unknown>[] = [
    // The row's own column: its number, and the play button that runs every
    // evaluator on just this example.
    {
      id: "row",
      header: () => <VisuallyHiddenHeader>Example</VisuallyHiddenHeader>,
      size: ROW_COLUMN_WIDTH,
      minSize: ROW_COLUMN_WIDTH,
      enableResizing: false,
    },
    { id: "input", header: "Input", size: 300, minSize: 200 },
    { id: "output", header: "Output", size: 300, minSize: 200 },
    ...visibleSlotIds.map((slot) => ({
      id: slot,
      size: 240,
      minSize: 180,
      header: () => (
        <EvaluatorColumnHeader
          slot={slot}
          name={slots[slot]?.name}
          run={runs[slot]}
          expected={expected[slot]}
          output={selectedOutput(slot)}
          examples={examples}
          canRun={!isLoading && !isRunning && runnableSlots.includes(slot)}
          onRun={() => onRunSlot(slot)}
        />
      ),
    })),
  ];
  return (
    <Flex direction="column" height="100%" minHeight={0}>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderBottomWidth="thin"
        borderBottomColor="default"
        flex="none"
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-200"
          wrap
        >
          <Text size="S" color="text-500">
            {isLoading && !examples.length
              ? "Loading sample…"
              : examples.length < sampleSize
                ? `All ${examples.length} examples`
                : `First ${sampleSize} examples`}
          </Text>
          <SegmentedControl
            aria-label="Show results"
            size="S"
            selectedKey={activeView.id}
            onSelectionChange={(key) => onFilterChange(String(key))}
          >
            {views.map((view) => (
              <SegmentedControlItem key={view.id} id={view.id}>
                <Flex direction="row" gap="size-75" alignItems="center">
                  {view.label}
                  <Counter
                    variant={view.id === activeView.id ? "quiet" : "default"}
                  >
                    {view.examples.length}
                  </Counter>
                </Flex>
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </Flex>
      </View>
      {staleSlots.length ? (
        <Alert variant="warning" banner>
          Evaluators {staleSlots.join(", ")} changed since the last run. Run
          again to review the current drafts.
        </Alert>
      ) : null}
      {reviewError ? (
        <Alert
          variant="danger"
          banner
          title="Could not save expected output"
          extra={
            <Flex direction="row" gap="size-100">
              <Button
                size="S"
                isDisabled={savingId != null}
                onPress={onRetryReview}
              >
                Retry
              </Button>
              <Button
                size="S"
                isDisabled={savingId != null}
                onPress={onReloadSample}
              >
                Load latest sample
              </Button>
            </Flex>
          }
        >
          {reviewError}
        </Alert>
      ) : null}
      <div css={tableWrapCSS}>
        <CalibrationResultsTable columns={columns} isLoading={isLoading}>
          {isLoading && !examples.length ? (
            <tbody>
              <tr>
                <td colSpan={visibleSlotIds.length + 3}>
                  <View paddingY="size-200">
                    <Loading size="S" />
                  </View>
                </td>
              </tr>
            </tbody>
          ) : !activeView.examples.length ? (
            <TableEmptyWrap>
              <CompactEmptyState
                icon={<Icon svg={<Icons.Database />} />}
                description="No examples"
                isFiltered={filter !== "all"}
              />
            </TableEmptyWrap>
          ) : (
            <tbody>
              {activeView.examples.map((example) => {
                const position = positions.get(example.id)!;
                return (
                  <tr key={example.id}>
                    <td className="table__cell results-table__row-cell">
                      <RowCell
                        position={position}
                        isPending={visibleSlotIds.some((slot) =>
                          runs[slot]?.queued.includes(example.id)
                        )}
                        canRun={canRunRows}
                        onRun={() => onRunExample(example.id)}
                      />
                    </td>
                    <td className="table__cell results-table__example-cell">
                      <ExampleFieldCell
                        label="input"
                        value={example.input}
                        position={position}
                      />
                    </td>
                    <td className="table__cell results-table__example-cell">
                      <ExampleFieldCell
                        label="output"
                        value={example.output}
                        position={position}
                      />
                    </td>
                    {visibleSlotIds.map((slot) => (
                      <td
                        className="table__cell results-table__evaluator-cell"
                        key={slot}
                      >
                        <EvaluatorCell
                          key={JSON.stringify([
                            slots[slot]?.name,
                            slots[slot]?.selectedOutputName,
                            slots[slot]?.outputNames.length === 1,
                          ])}
                          slot={slot}
                          name={slots[slot]?.name || `Evaluator ${slot}`}
                          position={position}
                          result={runs[slot]?.predictions[example.id]}
                          isLoading={isLoading}
                          isPending={!!runs[slot]?.queued.includes(example.id)}
                          expected={expected[slot]?.[example.id]}
                          output={selectedOutput(slot)}
                          slotRevision={slots[slot]?.revision}
                          isDisabled={
                            isLoading ||
                            savingId != null ||
                            !slots[slot]?.selectedOutputName
                          }
                          isSaving={savingId === example.id}
                          onSave={(output) => onReview(example, slot, output)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          )}
        </CalibrationResultsTable>
      </div>
    </Flex>
  );
}

// Wide enough for a two-digit row number over a small play button.
const ROW_COLUMN_WIDTH = 48;

/** A column header for a column whose meaning is carried by its cells. */
function VisuallyHiddenHeader({ children }: { children: ReactNode }) {
  return <span css={visuallyHiddenCSS}>{children}</span>;
}

const visuallyHiddenCSS = css`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

/**
 * The leading cell of a row: its number, and a play button — shown on hover,
 * like the row actions elsewhere in the app — that runs every evaluator on
 * this one example. Together with the play in each evaluator's column header
 * this makes the direction of a run visible: down a column, or across a row.
 */
function RowCell({
  position,
  isPending,
  canRun,
  onRun,
}: {
  position: number;
  /** A run is still waiting on this row in at least one column. */
  isPending: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      gap="size-100"
      css={rowCellCSS}
    >
      <Text size="S" color="text-500" fontFamily="mono">
        {position}
      </Text>
      {isPending ? (
        <ProgressCircle isIndeterminate size="S" aria-label="Running" />
      ) : (
        <span className="results-table__row-play">
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label={`Run evaluators on example ${position}`}
              isDisabled={!canRun}
              onPress={onRun}
            >
              <Icon svg={<Icons.Play />} />
            </IconButton>
            <Tooltip>
              <TooltipArrow />
              Run evaluators on this example
            </Tooltip>
          </TooltipTrigger>
        </span>
      )}
    </Flex>
  );
}

const rowCellCSS = css`
  padding-top: var(--global-dimension-size-100);
`;

/**
 * An evaluator's column header: who it is, how it is doing against the
 * expected outputs so far, and the play button that runs it down the whole
 * sample. Keeping the metrics here means they scale with the number of
 * evaluators instead of crowding a shared summary strip.
 */
function EvaluatorColumnHeader({
  slot,
  name,
  run,
  expected,
  output,
  examples,
  canRun,
  onRun,
}: {
  slot: SlotId;
  name?: string;
  run?: CalibrationRun;
  expected?: Partial<Record<string, ExpectedOutput>>;
  output?: SlotOutput;
  examples: CalibrationExample[];
  canRun: boolean;
  onRun: () => void;
}) {
  // Examples with a persisted expected output. This is dataset state, so it
  // survives a reload while run results do not — hence "with expected", not
  // "reviewed", which would imply someone looked at this run.
  const withExpected = examples.filter((example) => expected?.[example.id]);
  // Agreement is counted over examples whose expectation the output config
  // can still produce, and says so: "2/2 agree" can't be mistaken for a share
  // of the whole sample.
  const verdicts = withExpected.map((example) =>
    getExpectedVerdict({
      prediction: run?.predictions[example.id],
      expected: expected?.[example.id],
      output,
    })
  );
  const graded = verdicts.filter((verdict) => verdict !== "invalid");
  const matches = graded.filter((verdict) => verdict === "match").length;
  const agreement =
    run && graded.length ? `${matches}/${graded.length} agree` : null;
  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="start"
      justifyContent="space-between"
      minWidth={0}
    >
      <Flex direction="column" gap="size-25" minWidth={0}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={getSlotIndex(slot)} size="XS" />
          <Truncate maxWidth="100%">{name || `Evaluator ${slot}`}</Truncate>
        </Flex>
        <Text size="XS" color="text-500" weight="normal">
          {withExpected.length}/{examples.length} with expected
          {agreement ? ` · ${agreement}` : ""}
        </Text>
      </Flex>
      {run?.isRunning ? (
        <View flex="none" paddingY="size-50">
          <ProgressCircle isIndeterminate size="S" aria-label="Running" />
        </View>
      ) : (
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label={`Run evaluator ${slot} on all examples`}
            isDisabled={!canRun}
            onPress={onRun}
          >
            <Icon svg={<Icons.Play />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Run evaluator {slot} on all examples
          </Tooltip>
        </TooltipTrigger>
      )}
    </Flex>
  );
}

/**
 * One evaluator's result for one example, rendered the way experiment rows
 * render annotations: a quiet label · score value with the details in a rich
 * tooltip and the explanation beneath, then the expected output as a band
 * along the bottom. Grading happens against the result: thumbs up records it
 * as the expected output, thumbs down opens the form to record what it should
 * have been. The band shows what is recorded and, when it disagrees with the
 * result, says so; pressing it opens the same form.
 */
function EvaluatorCell({
  slot,
  name,
  position,
  result,
  isLoading,
  isPending,
  expected,
  output,
  slotRevision,
  isDisabled,
  isSaving,
  onSave,
}: {
  slot: SlotId;
  name: string;
  position: number;
  result?: CalibrationResult;
  isLoading: boolean;
  isPending: boolean;
  expected?: ExpectedOutput;
  /** The slot's selected output, which the expected output must fit. */
  output?: SlotOutput;
  /** The slot's current draft revision, to tell whether the result is stale. */
  slotRevision?: string;
  isDisabled: boolean;
  isSaving: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  if (isLoading && isEditing) setIsEditing(false);
  const prediction = result?.status === "success" ? result : null;
  const verdict = getExpectedVerdict({ prediction: result, expected, output });
  const issue = expected ? getExpectedOutputIssue({ expected, output }) : null;
  const isStale = !!result && result.revision !== slotRevision;
  const canGrade = !!prediction && !isDisabled;
  const value = (
    <span
      css={valueCSS}
      aria-label={`Evaluator ${slot} result for example ${position}`}
    >
      <PredictionValue result={result} isPending={isPending} />
    </span>
  );
  return (
    <Flex
      direction="column"
      height="100%"
      minWidth={0}
      justifyContent="space-between"
    >
      <CellTop>
        <EvaluatorCellStatus
          result={result}
          isPending={isPending}
          isStale={isStale}
        />
      </CellTop>
      <Flex direction="column" gap="size-50" css={resultRegionCSS}>
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          justifyContent="space-between"
          minWidth={0}
        >
          {prediction ? (
            <AnnotationTooltip
              annotation={{
                name,
                label: prediction.label,
                score: prediction.score,
                explanation: prediction.explanation,
              }}
            >
              <Pressable>{value}</Pressable>
            </AnnotationTooltip>
          ) : (
            value
          )}
          {/* Grade the result. Both stay in place and read their state from
              the expected output, so agreeing twice clears it — an easy undo. */}
          <Flex direction="row" gap="size-25" alignItems="center" flex="none">
            <TooltipTrigger>
              <IconButton
                size="S"
                color={verdict === "match" ? "success" : "text-500"}
                aria-pressed={verdict === "match"}
                isDisabled={!canGrade}
                aria-label={
                  verdict === "match"
                    ? `Clear expected output for evaluator ${slot}, example ${position}`
                    : `Agree with evaluator ${slot}'s result for example ${position}`
                }
                onPress={() => {
                  if (verdict === "match") void onSave(null);
                  else if (prediction)
                    void onSave({
                      label: prediction.label,
                      score: prediction.score,
                      explanation: prediction.explanation,
                    });
                }}
              >
                <Icon svg={<Icons.ThumbsUp />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                {verdict === "match"
                  ? "Clear expected output"
                  : "Agree: record this result as expected"}
              </Tooltip>
            </TooltipTrigger>
            <TooltipTrigger>
              <IconButton
                size="S"
                color={verdict === "mismatch" ? "danger" : "text-500"}
                aria-pressed={verdict === "mismatch"}
                isDisabled={!canGrade}
                aria-label={`Disagree with evaluator ${slot}'s result for example ${position}`}
                onPress={() => setIsEditing(true)}
              >
                <Icon svg={<Icons.ThumbsDown />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                Disagree: record what was expected
              </Tooltip>
            </TooltipTrigger>
          </Flex>
        </Flex>
        {prediction?.explanation ? (
          // Same treatment as the trace annotations list — muted, clamped,
          // full text on hover — but clamped to the room this row gives it.
          <Truncate
            maxLines={EXPLANATION_MAX_LINES}
            title={prediction.explanation}
          >
            <Text size="S" color="text-500">
              {prediction.explanation}
            </Text>
          </Truncate>
        ) : null}
      </Flex>
      {/* Always present, like the annotation band under a prompt playground
          output: a cell with no expected output shows the same "--" placeholder
          that band shows before an evaluator has run. The band is the editor's
          trigger, so the form opens from it whether reached by press or by
          thumbs down. */}
      <DialogTrigger isOpen={isEditing} onOpenChange={setIsEditing}>
        <Pressable>
          <button
            className="button--reset"
            css={expectedBandCSS}
            data-verdict={verdict ?? undefined}
            disabled={isDisabled}
            aria-label={`Expected output for evaluator ${slot}, example ${position}. Press to edit.`}
          >
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              minWidth={0}
            >
              <Text size="XS" color="text-500">
                expected
              </Text>
              {expected ? (
                <CalibrationValue
                  label={expected.label}
                  score={expected.score}
                  size="S"
                />
              ) : (
                <Text fontFamily="mono" color="text-300">
                  --
                </Text>
              )}
            </Flex>
            {isSaving ? (
              <ProgressCircle isIndeterminate size="S" aria-label="Saving" />
            ) : (
              <ExpectedBandStatus verdict={verdict} issue={issue} />
            )}
          </button>
        </Pressable>
        <Popover placement="bottom start">
          <PopoverArrow />
          <Dialog
            aria-label={`Expected output for evaluator ${slot}`}
            style={{ width: 320 }}
          >
            {isEditing ? (
              <ExpectedOutputForm
                slot={slot}
                expected={expected}
                output={output}
                isDisabled={isDisabled}
                onSave={onSave}
                onClose={() => setIsEditing(false)}
              />
            ) : null}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </Flex>
  );
}

/**
 * How the recorded expectation stands, shown on the band itself so the
 * comparison reads where the expected value is rather than as a mark against
 * the result: nothing while they agree, a note when they differ, and a warning
 * when the output config can no longer produce the expected value.
 */
function ExpectedBandStatus({
  verdict,
  issue,
}: {
  verdict: ExpectedVerdict;
  issue: string | null;
}) {
  if (verdict === "invalid")
    return (
      <span css={bandStatusCSS} title={issue ?? undefined}>
        <Icon svg={<Icons.AlertTriangle />} />
        <Text size="XS" color="inherit">
          not in output config
        </Text>
      </span>
    );
  if (verdict === "mismatch")
    return (
      <span css={bandStatusCSS}>
        <Icon svg={<Icons.AlertCircle />} />
        <Text size="XS" color="inherit">
          differs from result
        </Text>
      </span>
    );
  return null;
}

const resultRegionCSS = css`
  flex: 1 1 auto;
  padding: var(--global-table-cell-padding-y) var(--global-table-cell-padding-x);
`;

// The band the experiment compare table draws under an output for its
// annotation list: a faint fill with a hairline above, running edge to edge.
// It is a button here, so it also takes the table's quiet hover wash.
const expectedBandCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--global-dimension-size-100);
  width: 100%;
  min-height: 32px;
  padding: var(--global-dimension-size-50) var(--global-table-cell-padding-x);
  border-top: var(--global-border-size-thin) solid var(--global-color-gray-100);
  background-color: var(--global-color-gray-50);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
  &:hover:not(:disabled),
  &:focus-visible {
    background-color: var(--global-color-gray-100);
  }
  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
  &:disabled {
    cursor: default;
  }
`;

// The result value sits flush with the thumbs beside it.
const valueCSS = css`
  display: flex;
  align-items: center;
  min-height: var(--global-button-height-s);
  min-width: 0;
`;

// Warning-toned band note; the icon and text share the color.
const bandStatusCSS = css`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--global-dimension-size-50);
  color: var(--global-color-warning);
`;

/**
 * A label · score pair in the annotation value style: the label in the body
 * font, the score in mono, a hairline divider between them.
 */
function CalibrationValue({
  label,
  score,
  size,
}: {
  label?: string | null;
  score?: number | null;
  size?: "XS" | "S" | "M";
}) {
  const hasLabel = label != null && label !== "";
  const hasScore = typeof score === "number";
  if (!hasLabel && !hasScore)
    return (
      <Text size={size} color="text-500">
        {NO_VALUE}
      </Text>
    );
  return (
    <span css={valuePartsCSS}>
      {hasLabel ? <Text size={size}>{label}</Text> : null}
      {hasLabel && hasScore ? (
        <span aria-hidden css={inlineDividerCSS} />
      ) : null}
      {hasScore ? (
        <AnnotationScoreText size={size} fontFamily="mono">
          {floatFormatter(score)}
        </AnnotationScoreText>
      ) : null}
    </span>
  );
}

const valuePartsCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
`;

/**
 * The expected-output editor shown in the band's popover. Its fields follow
 * the slot's selected output config: a choice of that output's labels (with
 * the label's configured score) for a categorical output, otherwise a score
 * within the output's bounds and a free label.
 */
function ExpectedOutputForm({
  slot,
  expected,
  output,
  isDisabled,
  onSave,
  onClose,
}: {
  slot: SlotId;
  expected?: ExpectedOutput;
  output?: SlotOutput;
  isDisabled: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(expected?.label ?? "");
  const [score, setScore] = useState<number | null>(expected?.score ?? null);
  const [explanation, setExplanation] = useState(expected?.explanation ?? "");
  const draft = getExpectedDraft({ label, score, output });
  async function save(next: ExpectedOutput | null) {
    const result = await onSave(next);
    if (result.ok) onClose();
  }
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        <Text weight="heavy">Expected output · {slot}</Text>
        {draft.isCategorical ? (
          <CategoricalExpectedFields
            labels={output?.labels ?? []}
            label={label}
            score={draft.score}
            onChange={setLabel}
          />
        ) : (
          <ScoredExpectedFields
            output={output}
            label={label}
            score={score}
            isScoreInBounds={draft.isScoreInBounds}
            onLabelChange={setLabel}
            onScoreChange={setScore}
          />
        )}
        <TextField value={explanation} onChange={setExplanation}>
          <Label>Explanation</Label>
          <Input placeholder="Optional" />
        </TextField>
        <Flex direction="row" justifyContent="end" gap="size-100">
          {expected ? (
            <Button
              size="S"
              variant="default"
              isDisabled={isDisabled}
              onPress={() => void save(null)}
            >
              Clear
            </Button>
          ) : null}
          <Button
            size="S"
            variant="primary"
            isDisabled={isDisabled || !draft.hasValue || !draft.isScoreInBounds}
            onPress={() =>
              void save({
                label: label.trim() || null,
                score: draft.score,
                explanation: explanation.trim() || null,
              })
            }
          >
            Save expected
          </Button>
        </Flex>
      </Flex>
    </View>
  );
}

/**
 * What the form would save, and whether it may: a categorical output takes
 * the chosen label's configured score, anything else the typed score as long
 * as it sits within the output's bounds.
 */
function getExpectedDraft({
  label,
  score,
  output,
}: {
  label: string;
  score: number | null;
  output?: SlotOutput;
}) {
  const labels = output?.labels ?? [];
  const isCategorical = labels.length > 0;
  if (isCategorical)
    return {
      isCategorical,
      score: output?.labelScores[label] ?? null,
      hasValue: labels.includes(label),
      isScoreInBounds: true,
    };
  const isScoreInBounds =
    score == null ||
    ((output?.lowerBound == null || score >= output.lowerBound) &&
      (output?.upperBound == null || score <= output.upperBound));
  return {
    isCategorical,
    score,
    hasValue: label.trim() !== "" || score != null,
    isScoreInBounds,
  };
}

/** Pick one of the output's labels; its score comes from the config. */
function CategoricalExpectedFields({
  labels,
  label,
  score,
  onChange,
}: {
  labels: string[];
  label: string;
  score: number | null;
  onChange: (label: string) => void;
}) {
  return (
    <Flex direction="column" gap="size-50">
      <CalibrationSelect
        label="Label"
        value={label}
        options={labels.map((name) => ({ id: name, name }))}
        onChange={onChange}
      />
      {score != null ? (
        <Text size="XS" color="text-500">
          Scores {floatFormatter(score)} in this output config.
        </Text>
      ) : null}
    </Flex>
  );
}

/** A score within the output's bounds, and an optional free label. */
function ScoredExpectedFields({
  output,
  label,
  score,
  isScoreInBounds,
  onLabelChange,
  onScoreChange,
}: {
  output?: SlotOutput;
  label: string;
  score: number | null;
  isScoreInBounds: boolean;
  onLabelChange: (label: string) => void;
  onScoreChange: (score: number | null) => void;
}) {
  const hasBounds = output?.lowerBound != null || output?.upperBound != null;
  return (
    <>
      <NumberField
        value={score ?? NaN}
        onChange={(next) => onScoreChange(Number.isNaN(next) ? null : next)}
        minValue={output?.lowerBound ?? undefined}
        maxValue={output?.upperBound ?? undefined}
        isInvalid={!isScoreInBounds}
      >
        <Label>Score</Label>
        <Input placeholder="Optional" />
        {hasBounds ? (
          <Text slot="description">
            from {output?.lowerBound ?? "−∞"} to {output?.upperBound ?? "∞"}
          </Text>
        ) : null}
      </NumberField>
      <TextField value={label} onChange={onLabelChange}>
        <Label>Label</Label>
        <Input placeholder="Optional" />
      </TextField>
    </>
  );
}

const tableWrapCSS = css`
  overflow: auto;
  scroll-padding-top: var(--global-dimension-size-800);
  flex: 1;
  min-height: 0;
`;

// Content height for the input and output cells. Sized so a typical single
// message input — a `messages` array holding one role/content pair, about nine
// lines pretty-printed — shows in full, since scanning inputs without expanding
// each one is the point of this table. Still shorter than the experiment
// table's primary content, as the evaluator cells beside these are two short
// rows.
const EXAMPLE_FIELD_HEIGHT = 220;

// Lines of explanation that fit an evaluator cell at that row height: the row is
// the example content plus its header strip; the evaluator cell spends its own
// strip, the value row, padding, and the expected band, leaving about six
// 20px lines. Clamping to that fills the cell without growing the row.
const EXPLANATION_MAX_LINES = 6;

const exampleFieldContentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
  .cm-editor {
    background: transparent !important;
  }
`;

/**
 * A dataset field (input or output) rendered the way the experiment compare
 * table renders an example: a header strip, a fixed-height content area that
 * fades, and the value as JSON. Always JSON — these fields are objects by
 * construction, and one representation is what lets the cell become an editor
 * later without a per-cell "which mode is this" decision.
 */
function ExampleFieldCell({
  label,
  value,
  position,
}: {
  label: "input" | "output";
  value: unknown;
  position: number;
}) {
  const json = JSON.stringify(value ?? null, null, 2);
  return (
    <Flex direction="column" height="100%">
      <CellTop
        extra={
          <DetailsPopover
            label={`View ${label} for example ${position}`}
            icon={<Icons.Expand />}
            width={560}
          >
            <JSONBlock
              value={json}
              basicSetup={{ lineNumbers: false, foldGutter: false }}
            />
          </DetailsPopover>
        }
      >
        <Text color="text-500">{label}</Text>
      </CellTop>
      <ExpandableContent height={EXAMPLE_FIELD_HEIGHT}>
        <div css={exampleFieldContentCSS}>
          <JSONBlock
            value={json}
            basicSetup={{ lineNumbers: false, foldGutter: false }}
          />
        </div>
      </ExpandableContent>
    </Flex>
  );
}

/**
 * The strip above an evaluator result, the counterpart of the prompt
 * playground's run status bar. Evaluator previews report no timing or cost, so
 * this shows what the cell itself knows: queued, done, failed, or outdated.
 */
function EvaluatorCellStatus({
  result,
  isPending,
  isStale,
}: {
  result?: CalibrationPrediction;
  isPending: boolean;
  isStale: boolean;
}) {
  if (isPending) {
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.Loader />} />
        <Text color="text-500">Queued</Text>
      </Flex>
    );
  }
  if (!result) return <Text color="text-500">Ready</Text>;
  if (result.status === "error") return <Text color="danger">Failed</Text>;
  if (isStale) return <Text color="warning">Evaluator changed since run</Text>;
  return <Text color="text-500">Evaluated</Text>;
}

/** The evaluator's output for one example, or why there isn't one yet. */
function PredictionValue({
  result,
  isPending,
}: {
  result?: CalibrationPrediction;
  isPending: boolean;
}) {
  if (!result) {
    return isPending ? (
      <ProgressCircle isIndeterminate size="S" aria-label="Evaluating" />
    ) : (
      <Text color="text-500">Press run to evaluate</Text>
    );
  }
  if (result.status === "error")
    return <PlaygroundErrorWrap>{result.error}</PlaygroundErrorWrap>;
  return <CalibrationValue label={result.label} score={result.score} />;
}

/** An icon button that opens its children in a popover. */
function DetailsPopover({
  label,
  icon,
  width = 400,
  children,
}: {
  label: string;
  icon: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  return (
    <DialogTrigger>
      <IconButton size="S" aria-label={label}>
        <Icon svg={icon} />
      </IconButton>
      <Popover placement="bottom end">
        <Dialog style={{ width }}>
          <View padding="size-200" maxHeight="size-6000" overflow="auto">
            {children}
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
