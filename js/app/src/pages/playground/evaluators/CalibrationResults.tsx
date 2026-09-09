import { css } from "@emotion/react";
import { useState, type ReactNode } from "react";
import { Pressable } from "react-aria-components";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Alert,
  Button,
  Counter,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
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
import { JSONText } from "@phoenix/components/code/JSONText";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import {
  inlineDividerCSS,
  quietHoverCSS,
} from "@phoenix/components/core/styles";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
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
import { CalibrationSelect } from "./CalibrationSelect";
import type { SlotId, SlotSnapshot } from "./evaluatorSlotTypes";
import { getSlotIndex } from "./evaluatorSlotTypes";

const NO_VALUE = "—";

export function CalibrationResults({
  examples,
  sampleSize,
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
  const views = [
    { id: "all", label: "All", examples },
    {
      id: "unreviewed",
      label: "Unreviewed",
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
            {examples.length < sampleSize
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
        <table
          css={css(tableCSS, borderedTableCSS, resultsTableCSS)}
          aria-label="Evaluator comparison results"
        >
          <thead>
            <tr>
              <th css={indexColumnCSS}>#</th>
              <th css={exampleColumnCSS}>Example</th>
              {visibleSlotIds.map((slot) => (
                <th key={slot} css={slotColumnCSS}>
                  <EvaluatorColumnHeader
                    slot={slot}
                    name={slots[slot]?.name}
                    run={runs[slot]}
                    expected={expected[slot]}
                    examples={examples}
                  />
                </th>
              ))}
            </tr>
          </thead>
          {!activeView.examples.length ? (
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
                const position = examples.indexOf(example) + 1;
                return (
                  <tr key={example.id}>
                    <td className="table__cell" css={indexColumnCSS}>
                      <Text color="text-500" fontFamily="mono">
                        {position}
                      </Text>
                    </td>
                    <td className="table__cell">
                      <ExampleCell example={example} position={position} />
                    </td>
                    {visibleSlotIds.map((slot) => (
                      <td className="table__cell" key={slot}>
                        <EvaluatorCell
                          key={`${slot}:${example.revisionId}:${slots[slot]?.revision}`}
                          slot={slot}
                          name={slots[slot]?.name || `Evaluator ${slot}`}
                          position={position}
                          result={runs[slot]?.predictions[example.id]}
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
                            savingId != null || !slots[slot]?.selectedOutputName
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
        </table>
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
        {reviewed.length}/{examples.length} reviewed
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
  isPending,
  expected,
  labels,
  isDisabled,
  isSaving,
  onSave,
}: {
  slot: SlotId;
  name: string;
  position: number;
  result?: CalibrationPrediction;
  isPending: boolean;
  expected?: ExpectedOutput;
  labels: string[];
  isDisabled: boolean;
  isSaving: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const prediction = result?.status === "success" ? result : null;
  const verdict =
    prediction && expected
      ? matchesExpectedOutput(prediction, expected)
        ? "match"
        : "mismatch"
      : null;
  const canAccept = prediction != null && verdict !== "match";
  const value = (
    <button
      className="button--reset"
      css={valueButtonCSS}
      aria-label={`Evaluator ${slot} result for example ${position}. Click to edit the expected output.`}
    >
      <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
        {verdict ? <VerdictIcon verdict={verdict} /> : null}
        <PredictionValue result={result} isPending={isPending} />
      </Flex>
    </button>
  );
  return (
    <Flex direction="column" gap="size-50" minWidth={0}>
      <Flex
        direction="row"
        gap="size-100"
        alignItems="center"
        justifyContent="space-between"
      >
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
              <ExpectedOutputForm
                slot={slot}
                expected={expected}
                labels={labels}
                isDisabled={isDisabled}
                onSave={onSave}
                onClose={() => setIsEditing(false)}
              />
            </Dialog>
          </Popover>
        </DialogTrigger>
        {isSaving ? (
          <ProgressCircle isIndeterminate size="S" aria-label="Saving" />
        ) : canAccept ? (
          <TooltipTrigger>
            <IconButton
              size="S"
              isDisabled={isDisabled}
              aria-label={`Accept evaluator ${slot}'s output as expected for example ${position}`}
              onPress={() =>
                void onSave({
                  label: prediction.label,
                  score: prediction.score,
                  explanation: prediction.explanation,
                })
              }
            >
              <Icon svg={<Icons.Checkmark />} />
            </IconButton>
            <Tooltip>
              <TooltipArrow />
              Accept as expected output
            </Tooltip>
          </TooltipTrigger>
        ) : null}
      </Flex>
      {expected ? (
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text size="XS" color="text-500">
            expected
          </Text>
          <CalibrationValue
            label={expected.label}
            score={expected.score}
            size="XS"
          />
        </Flex>
      ) : null}
    </Flex>
  );
}

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

// Two-line evaluator cells read better top-aligned with a little more room,
// the way the experiment compare table lays out its annotation lists.
const resultsTableCSS = css`
  --global-table-cell-padding-y: var(--global-dimension-size-150);
  tbody tr > td {
    vertical-align: top;
  }
`;

const tableWrapCSS = css`
  overflow: auto;
  scroll-padding-top: var(--global-dimension-size-800);
  flex: 1;
  min-height: 0;
`;

const indexColumnCSS = css`
  width: var(--global-dimension-size-500);
  text-align: right;
`;

const exampleColumnCSS = css`
  min-width: 360px;
`;

const slotColumnCSS = css`
  min-width: var(--global-dimension-size-2400);
`;

const exampleFieldCSS = css`
  display: grid;
  grid-template-columns: var(--global-dimension-size-600) minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  align-items: baseline;
  .font-mono,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** The example's input and output at a glance, with the full JSON a click away. */
function ExampleCell({
  example,
  position,
}: {
  example: CalibrationExample;
  position: number;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <Flex direction="column" gap="size-50" flex="1 1 auto" minWidth={0}>
        <div css={exampleFieldCSS}>
          <Text size="XS" color="text-500">
            input
          </Text>
          <Text size="S">
            <JSONText json={example.input} maxLength={120} disableTitle />
          </Text>
        </div>
        <div css={exampleFieldCSS}>
          <Text size="XS" color="text-500">
            output
          </Text>
          <Text size="S">
            <JSONText json={example.output} maxLength={120} disableTitle />
          </Text>
        </div>
      </Flex>
      <DetailsPopover
        label={`View example ${position}`}
        icon={<Icons.Expand />}
        width={560}
      >
        <JSONBlock
          value={JSON.stringify(
            { input: example.input, output: example.output },
            null,
            2
          )}
          basicSetup={{ lineNumbers: false, foldGutter: false }}
        />
      </DetailsPopover>
    </Flex>
  );
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
      <Text color="text-500">{NO_VALUE}</Text>
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
