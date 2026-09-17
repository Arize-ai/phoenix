import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable } from "react-aria-components";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Popover,
  PopoverArrow,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { AnnotationTooltip } from "@phoenix/components/annotation";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { CellTop } from "@phoenix/components/table";
import { PlaygroundErrorWrap } from "@phoenix/pages/playground/PlaygroundErrorWrap";

import type {
  EvaluatorOutput,
  EvaluatorPrediction,
  ExpectedOutput,
  ExpectedVerdict,
} from "../evaluators/evaluatorResults";
import {
  getExpectedOutputIssue,
  getExpectedVerdict,
} from "../evaluators/evaluatorResults";
import { EvaluatorOutputValue } from "./EvaluatorOutputValue";
import { ExpectedOutputForm } from "./ExpectedOutputForm";

/**
 * One evaluator task's verdict on one example, rendered the way experiment
 * rows render annotations: a quiet label · score value with the details in a
 * rich tooltip and the explanation beneath, then the expected output as a
 * band along the bottom. Annotating happens against the verdict: thumbs up
 * records it as the expected output, thumbs down opens the form to record
 * what it should have been. The band shows what is recorded and, when it
 * disagrees with the verdict, says so; pressing it opens the same form.
 */
export function PlaygroundEvaluatorCell({
  label,
  name,
  position,
  prediction,
  isPending,
  expected,
  output,
  isDisabled,
  onSave,
  extra,
}: {
  /** The evaluator's column letter, for the labels of its controls. */
  label: string;
  /** The evaluator's name, for the verdict's tooltip. */
  name: string;
  position: number;
  prediction?: EvaluatorPrediction;
  /** The run is under way and has not judged this example yet. */
  isPending: boolean;
  expected?: ExpectedOutput;
  /** The evaluator's reviewed output, which the expected output must fit. */
  output?: EvaluatorOutput;
  isDisabled: boolean;
  onSave: (output: ExpectedOutput | null) => Promise<UIOperationResult>;
  /** Controls for the cell's top strip: repetitions, the trace. */
  extra?: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const verdictValue = prediction?.status === "success" ? prediction : null;
  const verdict = getExpectedVerdict({ prediction, expected, output });
  const issue = expected ? getExpectedOutputIssue({ expected, output }) : null;
  const canAnnotate = !!verdictValue && !isDisabled;

  const value = (
    <span
      css={valueCSS}
      aria-label={`Evaluator ${label} result for example ${position}`}
    >
      <PredictionValue prediction={prediction} isPending={isPending} />
    </span>
  );

  return (
    <Flex
      direction="column"
      height="100%"
      minWidth={0}
      justifyContent="space-between"
    >
      <CellTop extra={extra}>
        <EvaluatorCellStatus prediction={prediction} isPending={isPending} />
      </CellTop>
      <Flex direction="column" gap="size-50" css={resultRegionCSS}>
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          justifyContent="space-between"
          minWidth={0}
        >
          {verdictValue ? (
            <AnnotationTooltip
              annotation={{
                name,
                label: verdictValue.label,
                score: verdictValue.score,
                explanation: verdictValue.explanation,
              }}
            >
              <Pressable>{value}</Pressable>
            </AnnotationTooltip>
          ) : (
            value
          )}
          {/* Annotate the verdict. Both stay in place and read their state from
              the expected output, so agreeing twice clears it — an easy undo.
              Nothing to agree with yet means nothing to show. */}
          {verdictValue ? (
            <Flex direction="row" gap="size-25" alignItems="center" flex="none">
              <TooltipTrigger>
                <IconButton
                  size="S"
                  color={verdict === "match" ? "success" : "text-500"}
                  aria-pressed={verdict === "match"}
                  isDisabled={!canAnnotate}
                  aria-label={
                    verdict === "match"
                      ? `Clear expected output for evaluator ${label}, example ${position}`
                      : `Agree with evaluator ${label}'s result for example ${position}`
                  }
                  onPress={() => {
                    if (verdict === "match") void onSave(null);
                    else
                      void onSave({
                        label: verdictValue.label,
                        score: verdictValue.score,
                        explanation: verdictValue.explanation,
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
                  isDisabled={!canAnnotate}
                  aria-label={`Disagree with evaluator ${label}'s result for example ${position}`}
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
          ) : null}
        </Flex>
        {verdictValue?.explanation ? (
          // Same treatment as the trace annotations list — muted, clamped,
          // full text on hover — but clamped to the room this row gives it.
          <Truncate
            maxLines={EXPLANATION_MAX_LINES}
            title={verdictValue.explanation}
          >
            <Text size="S" color="text-500">
              {verdictValue.explanation}
            </Text>
          </Truncate>
        ) : null}
      </Flex>
      {/* Always present, like the annotation band under a prompt output: a
          cell with no expected output shows the same "--" placeholder that
          band shows before an evaluator has run. The band is the editor's
          trigger, so the form opens from it whether reached by press or by
          thumbs down. */}
      <DialogTrigger isOpen={isEditing} onOpenChange={setIsEditing}>
        <Pressable>
          <button
            className="button--reset"
            css={expectedBandCSS}
            data-verdict={verdict ?? undefined}
            disabled={isDisabled}
            aria-label={`Expected output for evaluator ${label}, example ${position}. Press to edit.`}
          >
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              minWidth={0}
              flex="1 1 auto"
            >
              <Text size="XS" color="text-500" flex="none">
                expected
              </Text>
              {expected ? (
                <EvaluatorOutputValue
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
            <ExpectedBandStatus verdict={verdict} issue={issue} />
          </button>
        </Pressable>
        <Popover placement="bottom start">
          <PopoverArrow />
          <Dialog
            aria-label={`Expected output for evaluator ${label}`}
            style={{ width: 320 }}
          >
            {isEditing ? (
              <ExpectedOutputForm
                label={label}
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
 * the verdict: nothing while they agree, a note when they differ, and a
 * warning when the output config can no longer produce the expected value.
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
      <span
        css={bandStatusCSS}
        title={issue ?? "Not one of this output's labels or scores"}
      >
        <Icon svg={<Icons.AlertTriangle />} />
        <span className="expected-band__status-text">
          <Text size="XS" color="inherit">
            not in config
          </Text>
        </span>
      </span>
    );

  if (verdict === "mismatch")
    return (
      <span css={bandStatusCSS} title="Differs from the evaluator's result">
        <Icon svg={<Icons.AlertCircle />} />
        <span className="expected-band__status-text">
          <Text size="XS" color="inherit">
            differs
          </Text>
        </span>
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
  container: expected-band / inline-size;
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

// The verdict sits flush with the thumbs beside it and yields to them when
// the column is narrow.
const valueCSS = css`
  display: flex;
  align-items: center;
  min-height: var(--global-button-height-s);
  min-width: 0;
  flex: 1 1 auto;
`;

// Below this the band cannot fit "expected", a label, a score, and a note.
const NARROW_BAND_WIDTH = 200;

// Warning-toned band note; the icon and text share the color. In a narrow
// column the words go and the icon stays, with the words in its title.
const bandStatusCSS = css`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--global-dimension-size-50);
  color: var(--global-color-warning);
  @container expected-band (width < ${NARROW_BAND_WIDTH}px) {
    .expected-band__status-text {
      display: none;
    }
  }
`;

// Lines of explanation that fit an evaluator cell at the table's row height:
// the row is the example content plus its header strip; the evaluator cell
// spends its own strip, the value row, padding, and the expected band, leaving
// about six 20px lines. Clamping to that fills the cell without growing the row.
const EXPLANATION_MAX_LINES = 6;

/**
 * The strip above an evaluator verdict, the counterpart of the prompt cell's
 * run status. It says what the cell itself knows: queued, done, or failed.
 */
function EvaluatorCellStatus({
  prediction,
  isPending,
}: {
  prediction?: EvaluatorPrediction;
  isPending: boolean;
}) {
  if (isPending) {
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.Loader />} />
        <Text color="text-500">Queued</Text>
      </Flex>
    );
  }

  if (!prediction) return <Text color="text-500">Ready</Text>;

  if (prediction.status === "error") return <Text color="danger">Failed</Text>;

  return <Text color="text-500">Evaluated</Text>;
}

/** The evaluator's verdict for one example, or why there isn't one yet. */
function PredictionValue({
  prediction,
  isPending,
}: {
  prediction?: EvaluatorPrediction;
  isPending: boolean;
}) {
  if (!prediction) {
    return isPending ? (
      <ProgressCircle isIndeterminate size="S" aria-label="Evaluating" />
    ) : (
      <Text color="text-500">Press run to evaluate</Text>
    );
  }

  if (prediction.status === "error")
    return <PlaygroundErrorWrap>{prediction.error}</PlaygroundErrorWrap>;

  return (
    <EvaluatorOutputValue label={prediction.label} score={prediction.score} />
  );
}
