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
import {
  inlineDividerCSS,
  quietHoverCSS,
} from "@phoenix/components/core/styles";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { CellTop } from "@phoenix/components/table";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { PlaygroundErrorWrap } from "../PlaygroundErrorWrap";
import type {
  CalibrationExample,
  CalibrationPrediction,
  CalibrationRun,
  ExpectedOutput,
  SlotExpectations,
} from "./calibration";
import { matchesExpectedOutput } from "./calibration";
import { CalibrationResultsTable } from "./CalibrationResultsTable";
import { CalibrationSelect } from "./CalibrationSelect";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";
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
  savingId: string | null;
  reviewError: string | null;
  staleSlots: string[];
  onRetryReview: () => void;
  onReloadSample: () => void;
}) {
  const positions = new Map(
    examples.map((example, index) => [example.id, index + 1])
  );
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
      id: "disagreements",
      label: "Mismatches",
      examples: examples.filter((example) =>
        visibleSlotIds.some((slot) => {
          const output = expected[slot]?.[example.id];
          const prediction = runs[slot]?.predictions[example.id];
          return (
            output && prediction && !matchesExpectedOutput(prediction, output)
          );
        })
      ),
    },
  ];
  const activeView = views.find((view) => view.id === filter) ?? views[0];
  const columns: ColumnDef<unknown>[] = [
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
          examples={examples}
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
                <td colSpan={visibleSlotIds.length + 2}>
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
                          isPending={
                            !!runs[slot]?.isRunning &&
                            !runs[slot]?.predictions[example.id]
                          }
                          expected={expected[slot]?.[example.id]}
                          labels={
                            slots[slot]?.outputNames.find(
                              (output) =>
                                output.name === slots[slot]?.selectedOutputName
                            )?.labels ?? []
                          }
                          isDisabled={
                            isLoading ||
                            savingId != null ||
                            !slots[slot]?.selectedOutputName
                          }
                          isSaving={savingId === example.id}
                          isStale={staleSlots.includes(slot)}
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

/**
 * An evaluator's column header: who it is, and how it is doing against the
 * expected outputs reviewed so far. Keeping the metrics here means they scale
 * with the number of evaluators instead of crowding a shared summary strip.
 */
function EvaluatorColumnHeader({
  slot,
  name,
  run,
  expected,
  examples,
}: {
  slot: SlotId;
  name?: string;
  run?: CalibrationRun;
  expected?: Partial<Record<string, ExpectedOutput>>;
  examples: CalibrationExample[];
}) {
  const reviewed = examples.filter((example) => expected?.[example.id]);
  const matches = reviewed.filter((example) =>
    matchesExpectedOutput(run?.predictions[example.id], expected![example.id]!)
  ).length;
  // Agreement is counted over reviewed examples only, so say so: "2/2 agree"
  // can't be mistaken for a share of the whole sample.
  const agreement =
    run && reviewed.length ? `${matches}/${reviewed.length} agree` : null;
  return (
    <Flex direction="column" gap="size-25" minWidth={0}>
      <Flex direction="row" gap="size-100" alignItems="center">
        <AlphabeticIndexIcon index={getSlotIndex(slot)} size="XS" />
        <Truncate maxWidth="100%">{name || `Evaluator ${slot}`}</Truncate>
        {run?.isRunning ? <ProgressCircle isIndeterminate size="S" /> : null}
      </Flex>
      <Text size="XS" color="text-500" weight="normal">
        {reviewed.length}/{examples.length} with expected
        {agreement ? ` · ${agreement}` : ""}
      </Text>
    </Flex>
  );
}

/**
 * One evaluator's result for one example, rendered the way experiment rows
 * render annotations: a quiet label · score value with the details in a rich
 * tooltip, and the expected output as a muted second line. Clicking the value
 * opens the expected-output editor; accepting the prediction as expected is the
 * one always-visible action, and only while the two disagree.
 */
function EvaluatorCell({
  slot,
  name,
  position,
  result,
  isLoading,
  isPending,
  expected,
  labels,
  isDisabled,
  isSaving,
  isStale,
  onSave,
}: {
  slot: SlotId;
  name: string;
  position: number;
  result?: CalibrationPrediction;
  isLoading: boolean;
  isPending: boolean;
  expected?: ExpectedOutput;
  labels: string[];
  isDisabled: boolean;
  isSaving: boolean;
  /** The evaluator changed since this result was produced. */
  isStale: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  if (isLoading && isEditing) setIsEditing(false);
  const prediction = result?.status === "success" ? result : null;
  const verdict =
    prediction && expected
      ? matchesExpectedOutput(prediction, expected)
        ? "match"
        : "mismatch"
      : null;
  const value = (
    <button
      className="button--reset"
      css={valueButtonCSS}
      aria-label={`Evaluator ${slot} result for example ${position}. Click to edit the expected output.`}
    >
      <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
        {verdict === "mismatch" ? <VerdictIcon verdict={verdict} /> : null}
        <PredictionValue result={result} isPending={isPending} />
      </Flex>
    </button>
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
        <DialogTrigger isOpen={isEditing} onOpenChange={setIsEditing}>
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
            <Pressable>{value}</Pressable>
          )}
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
                  labels={labels}
                  isDisabled={isDisabled}
                  onSave={onSave}
                  onClose={() => setIsEditing(false)}
                />
              ) : null}
            </Dialog>
          </Popover>
        </DialogTrigger>
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
          output: an unreviewed cell shows the same "--" placeholder that band
          shows before an evaluator has run. */}
      <div css={expectedBandCSS}>
        <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
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
        {/* One control in one place: pressed while the expected output is the
            prediction, so pressing again clears it — an easy undo. */}
        {isSaving ? (
          <ProgressCircle isIndeterminate size="S" aria-label="Saving" />
        ) : (
          <TooltipTrigger>
            <IconButton
              size="S"
              // Ghost like the other row actions; the pressed state is carried
              // by the success color rather than a filled button.
              color={verdict === "match" ? "success" : "text-500"}
              aria-pressed={verdict === "match"}
              isDisabled={isDisabled || (!prediction && verdict !== "match")}
              aria-label={
                verdict === "match"
                  ? `Clear expected output for evaluator ${slot}, example ${position}`
                  : `Accept evaluator ${slot}'s output as expected for example ${position}`
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
              <Icon svg={<Icons.Checkmark />} />
            </IconButton>
            <Tooltip>
              <TooltipArrow />
              {verdict === "match"
                ? "Clear expected output"
                : "Accept as expected output"}
            </Tooltip>
          </TooltipTrigger>
        )}
      </div>
    </Flex>
  );
}

const resultRegionCSS = css`
  flex: 1 1 auto;
  padding: var(--global-table-cell-padding-y) var(--global-table-cell-padding-x);
`;

// The band the experiment compare table draws under an output for its
// annotation list: a faint fill with a hairline above, running edge to edge.
const expectedBandCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--global-dimension-size-100);
  min-height: 32px;
  padding: var(--global-dimension-size-50) var(--global-table-cell-padding-x);
  border-top: var(--global-border-size-thin) solid var(--global-color-gray-100);
  background-color: var(--global-color-gray-50);
`;

// The quiet hover wash the rest of the app uses for click-to-reveal text,
// sized so the value sits flush with the accept button beside it.
const valueButtonCSS = css`
  ${quietHoverCSS};
  display: flex;
  align-items: center;
  min-height: var(--global-button-height-s);
  min-width: 0;
  text-align: left;
`;

const verdictIconCSS = css`
  display: flex;
  flex: none;
  &[data-verdict="match"] {
    color: var(--global-color-success);
  }
  &[data-verdict="mismatch"] {
    color: var(--global-color-danger);
  }
`;

/** Whether the prediction agrees with the expected output. */
function VerdictIcon({ verdict }: { verdict: "match" | "mismatch" }) {
  return (
    <span
      css={verdictIconCSS}
      data-verdict={verdict}
      role="img"
      aria-label={
        verdict === "match" ? "Matches expected" : "Differs from expected"
      }
    >
      <Icon svg={verdict === "match" ? <Icons.Checkmark /> : <Icons.Close />} />
    </span>
  );
}

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

/** The expected-output editor shown inside a result's popover. */
function ExpectedOutputForm({
  slot,
  expected,
  labels,
  isDisabled,
  onSave,
  onClose,
}: {
  slot: SlotId;
  expected?: ExpectedOutput;
  labels: string[];
  isDisabled: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(expected?.label ?? "");
  const [score, setScore] = useState(
    expected?.score != null ? String(expected.score) : ""
  );
  const [explanation, setExplanation] = useState(expected?.explanation ?? "");
  const hasValue = label.trim() !== "" || score !== "";
  const isValidScore = score === "" || Number.isFinite(Number(score));
  async function save(output: ExpectedOutput | null) {
    const result = await onSave(output);
    if (result.ok) onClose();
  }
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        <Text weight="heavy">Expected output · {slot}</Text>
        {labels.length ? (
          <CalibrationSelect
            label="Label"
            value={label || "__none"}
            options={[
              { id: "__none", name: "No label" },
              ...labels.map((name) => ({ id: name, name })),
            ]}
            onChange={(value) => setLabel(value === "__none" ? "" : value)}
          />
        ) : (
          <TextField value={label} onChange={setLabel}>
            <Label>Label</Label>
            <Input />
          </TextField>
        )}
        <TextField value={score} onChange={setScore} isInvalid={!isValidScore}>
          <Label>Score</Label>
          <Input inputMode="decimal" placeholder="Optional" />
        </TextField>
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
            isDisabled={isDisabled || !hasValue || !isValidScore}
            onPress={() =>
              void save({
                label: label.trim() || null,
                score: score === "" ? null : Number(score),
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
        <Text color="text-500">
          {label === "input" ? `example ${position}` : "output"}
        </Text>
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
