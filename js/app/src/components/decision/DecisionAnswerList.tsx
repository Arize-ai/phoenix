import { css } from "@emotion/react";
import type { CSSProperties } from "react";

import { Flex, ProgressBar, Text } from "@phoenix/components";

import {
  formatOmittedOptions,
  formatPercent,
  getNearestLevelIndex,
  type NormalizedDecisionAnswer,
} from "./decisionAnswers";

const distributionCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) 3.5em;
  column-gap: var(--global-dimension-size-100);
  row-gap: var(--global-dimension-size-50);
  align-items: center;
  font-variant-numeric: tabular-nums;
`;

const wrapAnywhereCSS = css`
  overflow-wrap: anywhere;
`;

const alignEndCSS = css`
  text-align: right;
`;

const metaCSS = css`
  margin-left: auto;
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const answerListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
`;

// Rows the model did not pick step back to a muted neutral so the eye finds
// the answer; the chosen row keeps the bar's primary fill.
const unchosenBarStyle = {
  "--mod-barloader-fill-color": "var(--global-color-primary-300)",
} as CSSProperties;

/**
 * A probability drawn with the design system's bar. The chosen row keeps
 * the primary fill; the rest step back so the eye finds the answer.
 */
function ProbabilityBar({
  value,
  label,
  isChosen = false,
}: {
  value: number | null;
  label: string;
  isChosen?: boolean;
}) {
  const percentage = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={isChosen ? undefined : unchosenBarStyle}>
      <ProgressBar aria-label={label} value={percentage} width="100%" />
    </div>
  );
}

function DistributionRow({
  label,
  index,
  value,
  isChosen,
  barLabel,
}: {
  label: string;
  index?: number;
  value: number | null;
  isChosen: boolean;
  barLabel: string;
}) {
  return (
    <>
      <Flex direction="row" gap="size-75" alignItems="baseline" minWidth={0}>
        {index != null ? (
          <Text size="XS" color="text-700" fontFamily="mono">
            {index}
          </Text>
        ) : null}
        <Text
          size="S"
          weight={isChosen ? "heavy" : "normal"}
          color={isChosen ? "text-900" : "text-700"}
          css={wrapAnywhereCSS}
        >
          {label}
        </Text>
      </Flex>
      <ProbabilityBar value={value} label={barLabel} isChosen={isChosen} />
      <Text
        size="S"
        color={isChosen ? "text-900" : "text-700"}
        css={alignEndCSS}
      >
        {formatPercent(value)}
      </Text>
    </>
  );
}

/**
 * One question's answer, drawn to show the distribution the model returned
 * rather than only the arg-max. Provider values are shown as reported; a
 * scale answer is the provider's weighted position on the author's scale.
 */
function DecisionAnswerView({ answer }: { answer: NormalizedDecisionAnswer }) {
  switch (answer.kind) {
    case "choice":
    case "predicate":
      if (answer.probabilities.length === 0) {
        return (
          <Text size="S" weight="heavy">
            {answer.choice ?? "–"}
          </Text>
        );
      }
      return (
        <div css={distributionCSS} aria-label={`${answer.name} probabilities`}>
          {answer.probabilities.map((entry) => (
            <DistributionRow
              key={entry.value}
              label={entry.value}
              value={entry.probability}
              isChosen={entry.value === answer.choice}
              barLabel={`${entry.value} probability`}
            />
          ))}
        </div>
      );
    case "scale": {
      const nearestLevelIndex = getNearestLevelIndex({
        expectedLevel: answer.expectedLevel,
        levelIndices: answer.levels.map((level) => level.index),
      });
      return (
        <div css={distributionCSS} aria-label={`${answer.name} scale levels`}>
          {answer.levels.map((level) => (
            <DistributionRow
              key={level.index}
              index={level.index}
              label={level.label}
              value={level.probability}
              isChosen={nearestLevelIndex === level.index}
              barLabel={`${level.label} probability`}
            />
          ))}
        </div>
      );
    }
    case "refusal":
      return (
        <Text size="S" color="warning">
          The provider declined to answer this question.
        </Text>
      );
    default:
      return (
        <Text size="S" color="text-700">
          Unrecognized answer; see the raw response.
        </Text>
      );
  }
}

/**
 * The arg-max as plain text, for tests and assistive tech. The bars already
 * carry it visually, so callers render it hidden.
 */
function getAnswerValue(answer: NormalizedDecisionAnswer): string {
  switch (answer.kind) {
    case "choice":
      return answer.choice ?? "";
    case "scale":
      return answer.expectedLevel == null
        ? ""
        : answer.expectedLevel.toFixed(2);
    case "predicate":
      return formatPercent(answer.probability);
    case "refusal":
      return "Refused";
    default:
      return "";
  }
}

/**
 * The numbers the bars cannot show: a scale's expected level and the
 * provider's confidence. One short line, or nothing.
 */
function getAnswerMeta(
  answer: NormalizedDecisionAnswer | undefined
): string | null {
  if (!answer) return null;
  const parts: string[] = [];
  if (answer.kind === "scale" && answer.expectedLevel != null) {
    parts.push(`expected level ${answer.expectedLevel.toFixed(2)}`);
  }
  if (
    (answer.kind === "choice" || answer.kind === "scale") &&
    answer.confidence != null
  ) {
    parts.push(`confidence ${formatPercent(answer.confidence)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/** Right-aligned meta line under a distribution; renders nothing when empty. */
function AnswerMeta({
  answer,
}: {
  answer: NormalizedDecisionAnswer | undefined;
}) {
  const meta = getAnswerMeta(answer);
  const omittedCount =
    answer?.kind === "choice" || answer?.kind === "predicate"
      ? answer.omittedOptionCount
      : 0;
  if (meta == null && omittedCount === 0) return null;
  return (
    <Flex direction="row" gap="size-100" alignItems="baseline">
      {omittedCount > 0 ? (
        <Text size="XS" color="text-500">
          {formatOmittedOptions(omittedCount)}
        </Text>
      ) : null}
      {meta != null ? (
        <Text size="XS" color="text-700" css={metaCSS}>
          {meta}
        </Text>
      ) : null}
    </Flex>
  );
}

/** Each answer's question name, distribution and meta line. */
export function DecisionAnswerList({
  answers,
}: {
  answers: readonly NormalizedDecisionAnswer[];
}) {
  return (
    <ul css={answerListCSS} aria-label="Decision answers">
      {answers.map((answer) => (
        <li key={answer.name}>
          <Flex direction="column" gap="size-75">
            <Text
              size="S"
              color="text-700"
              fontFamily="mono"
              css={wrapAnywhereCSS}
            >
              {answer.name}
            </Text>
            <span data-testid={`answer-${answer.name}`} hidden>
              {getAnswerValue(answer)}
            </span>
            <DecisionAnswerView answer={answer} />
            <AnswerMeta answer={answer} />
          </Flex>
        </li>
      ))}
    </ul>
  );
}
