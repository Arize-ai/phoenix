import { css } from "@emotion/react";
import { useMemo } from "react";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlockWithCopy } from "@phoenix/components/code";
import type { DecisionRequestDraft } from "@phoenix/store/playground/types";

import {
  type NormalizedDecisionAnswer,
  normalizeDecisionResult,
} from "./decisionUtils";

const barTrackCSS = css`
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--global-color-primary-100);
  overflow: hidden;
`;

const barFillCSS = css`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 3px;
  background: var(--global-color-primary-500);
  &[data-chosen="true"] {
    background: var(--global-color-primary-900);
  }
`;

const distributionCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) 3.5em;
  column-gap: var(--global-dimension-size-100);
  row-gap: var(--global-dimension-size-50);
  align-items: center;
  font-variant-numeric: tabular-nums;
`;

function percent(value: number | null): string {
  return value == null ? "–" : `${Math.round(value * 100)}%`;
}

function ProbabilityBar({
  value,
  chosen = false,
}: {
  value: number | null;
  chosen?: boolean;
}) {
  const width = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      css={barTrackCSS}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
    >
      <div
        css={barFillCSS}
        data-chosen={chosen}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/**
 * One question's answer, drawn to show the distribution the model returned
 * rather than only the arg-max. Provider values are shown as reported; a
 * score is the provider's weighted position on the author's scale.
 */
export function DecisionAnswerView({
  answer,
}: {
  answer: NormalizedDecisionAnswer;
}) {
  switch (answer.kind) {
    case "choice":
      return (
        <div css={distributionCSS} aria-label={`${answer.name} probabilities`}>
          {answer.probabilities.map((p) => {
            const chosen = p.value === answer.choice;
            return (
              <Flex
                key={p.value}
                direction="row"
                gap="size-100"
                alignItems="center"
                css={css`
                  display: contents;
                `}
              >
                <Text
                  size="S"
                  weight={chosen ? "heavy" : "normal"}
                  color={chosen ? "text-900" : "text-700"}
                  css={css`
                    overflow-wrap: anywhere;
                  `}
                >
                  {p.value}
                </Text>
                <ProbabilityBar value={p.probability} chosen={chosen} />
                <Text
                  size="S"
                  color={chosen ? "text-900" : "text-700"}
                  css={css`
                    text-align: right;
                  `}
                >
                  {percent(p.probability)}
                </Text>
              </Flex>
            );
          })}
          {answer.probabilities.length === 0 && answer.choice != null ? (
            <Text
              size="S"
              weight="heavy"
              css={css`
                grid-column: 1 / -1;
              `}
            >
              {answer.choice}
            </Text>
          ) : null}
        </div>
      );
    case "score": {
      const nearest =
        answer.score == null
          ? null
          : answer.levels.reduce<{ index: number; label: string } | null>(
              (best, level) =>
                best == null ||
                Math.abs(level.index - answer.score!) <
                  Math.abs(best.index - answer.score!)
                  ? level
                  : best,
              null
            );
      return (
        <div css={distributionCSS} aria-label={`${answer.name} score levels`}>
          {answer.levels.map((level) => {
            const chosen = nearest?.index === level.index;
            return (
              <Flex
                key={level.index}
                direction="row"
                css={css`
                  display: contents;
                `}
              >
                <Text
                  size="S"
                  weight={chosen ? "heavy" : "normal"}
                  color={chosen ? "text-900" : "text-700"}
                  css={css`
                    overflow-wrap: anywhere;
                  `}
                >
                  <Text
                    size="XS"
                    color="text-700"
                    css={css`
                      font-family: var(--global-font-family-mono);
                      margin-right: 0.5em;
                    `}
                  >
                    {level.index}
                  </Text>
                  {level.label}
                </Text>
                <ProbabilityBar value={level.probability} chosen={chosen} />
                <Text
                  size="S"
                  color={chosen ? "text-900" : "text-700"}
                  css={css`
                    text-align: right;
                  `}
                >
                  {percent(level.probability)}
                </Text>
              </Flex>
            );
          })}
        </div>
      );
    }
    case "noul":
      return (
        <div css={distributionCSS} aria-label={`${answer.name} probability`}>
          <Text size="S" weight="heavy">
            {answer.probability == null
              ? "–"
              : answer.probability >= 0.5
                ? "True"
                : "False"}
          </Text>
          <ProbabilityBar value={answer.probability} chosen />
          <Text
            size="S"
            css={css`
              text-align: right;
            `}
          >
            {percent(answer.probability)}
          </Text>
        </div>
      );
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

function answerHeadline(answer: NormalizedDecisionAnswer): string {
  switch (answer.kind) {
    case "choice":
      return answer.choice ?? "–";
    case "score":
      return answer.score == null ? "–" : answer.score.toFixed(2);
    case "noul":
      return percent(answer.probability);
    case "refusal":
      return "Refused";
    default:
      return "–";
  }
}

function confidenceOf(answer: NormalizedDecisionAnswer): number | null {
  return answer.kind === "choice" || answer.kind === "score"
    ? answer.confidence
    : null;
}

/** Full result for one instance: every answer, usage, and the raw body. */
export function DecisionResult({
  output,
  request,
}: {
  output: string;
  request: DecisionRequestDraft | null;
}) {
  const result = useMemo(() => {
    try {
      return normalizeDecisionResult(JSON.parse(output), request);
    } catch {
      return normalizeDecisionResult(null, request);
    }
  }, [output, request]);
  return (
    <Flex direction="column" gap="size-200">
      <ul
        css={css`
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--global-dimension-size-150);
        `}
        aria-label="Decision answers"
      >
        {result.answers.map((answer) => {
          const confidence = confidenceOf(answer);
          return (
            <li key={answer.name}>
              <Flex direction="column" gap="size-75">
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  gap="size-100"
                >
                  <Text
                    weight="heavy"
                    css={css`
                      overflow-wrap: anywhere;
                    `}
                  >
                    {answer.name}
                  </Text>
                  <Flex direction="row" gap="size-100" alignItems="baseline">
                    {confidence != null ? (
                      <Text size="XS" color="text-700">
                        confidence {percent(confidence)}
                      </Text>
                    ) : null}
                    <Text weight="heavy" data-testid={`answer-${answer.name}`}>
                      {answerHeadline(answer)}
                    </Text>
                  </Flex>
                </Flex>
                <DecisionAnswerView answer={answer} />
              </Flex>
            </li>
          );
        })}
      </ul>
      <Text
        size="XS"
        color="text-700"
        css={css`
          font-variant-numeric: tabular-nums;
        `}
      >
        {result.model ? `${result.model} · ` : ""}
        {result.usage.input != null
          ? `${result.usage.input} input`
          : "input tokens unknown"}
        {" · "}
        {result.usage.output != null
          ? `${result.usage.output} output`
          : "output tokens unknown"}
        {" tokens"}
      </Text>
      <Disclosure id="raw-response" size="S">
        <DisclosureTrigger>Raw response</DisclosureTrigger>
        <DisclosurePanel>
          <View paddingTop="size-100">
            <JSONBlockWithCopy value={output} />
          </View>
        </DisclosurePanel>
      </Disclosure>
    </Flex>
  );
}
