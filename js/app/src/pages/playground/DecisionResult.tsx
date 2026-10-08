import { css } from "@emotion/react";
import type { CSSProperties } from "react";
import { useMemo } from "react";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  ProgressBar,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlockWithCopy } from "@phoenix/components/code";
import type { DecisionRequestDraft } from "@phoenix/store/playground/types";

import {
  type NormalizedDecisionAnswer,
  normalizeDecisionResult,
} from "./decisionUtils";

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

export function formatPercent(value: number | null): string {
  return value == null ? "–" : `${Math.round(value * 100)}%`;
}

/**
 * A probability drawn with the design system's bar. The chosen row keeps
 * the primary fill; the rest step back to gray so the eye finds the answer.
 */
function ProbabilityBar({
  value,
  label,
  chosen = false,
}: {
  value: number | null;
  label: string;
  chosen?: boolean;
}) {
  const percentage = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      style={
        chosen
          ? undefined
          : ({
              "--mod-barloader-fill-color": "var(--global-color-gray-500)",
            } as CSSProperties)
      }
    >
      <ProgressBar aria-label={label} value={percentage} width="100%" />
    </div>
  );
}

function DistributionRow({
  label,
  index,
  value,
  chosen,
  barLabel,
}: {
  label: string;
  index?: number;
  value: number | null;
  chosen: boolean;
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
          weight={chosen ? "heavy" : "normal"}
          color={chosen ? "text-900" : "text-700"}
          css={wrapAnywhereCSS}
        >
          {label}
        </Text>
      </Flex>
      <ProbabilityBar value={value} label={barLabel} chosen={chosen} />
      <Text size="S" color={chosen ? "text-900" : "text-700"} css={alignEndCSS}>
        {formatPercent(value)}
      </Text>
    </>
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
      if (answer.probabilities.length === 0) {
        return (
          <Text size="S" weight="heavy">
            {answer.choice ?? "–"}
          </Text>
        );
      }
      return (
        <div css={distributionCSS} aria-label={`${answer.name} probabilities`}>
          {answer.probabilities.map((p) => (
            <DistributionRow
              key={p.value}
              label={p.value}
              value={p.probability}
              chosen={p.value === answer.choice}
              barLabel={`${p.value} probability`}
            />
          ))}
        </div>
      );
    case "score": {
      const nearest =
        answer.score == null
          ? null
          : answer.levels.reduce<number | null>((best, level) => {
              if (best == null) return level.index;
              return Math.abs(level.index - (answer.score as number)) <
                Math.abs(best - (answer.score as number))
                ? level.index
                : best;
            }, null);
      return (
        <div css={distributionCSS} aria-label={`${answer.name} score levels`}>
          {answer.levels.map((level) => (
            <DistributionRow
              key={level.index}
              index={level.index}
              label={level.label}
              value={level.probability}
              chosen={nearest === level.index}
              barLabel={`${level.label} probability`}
            />
          ))}
        </div>
      );
    }
    case "noul":
      return (
        <div css={distributionCSS} aria-label={`${answer.name} probability`}>
          <DistributionRow
            label={
              answer.probability == null
                ? "–"
                : answer.probability >= 0.5
                  ? "True"
                  : "False"
            }
            value={answer.probability}
            chosen
            barLabel={`${answer.name} probability of true`}
          />
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

/**
 * The short value to show beside a question name. Choice and score answers
 * already carry their value in the emphasized distribution row, so only
 * noul, refusal, and scores (a number the bars cannot show) get a headline.
 */
export function answerHeadline(
  answer: NormalizedDecisionAnswer | undefined
): string | null {
  if (!answer) return null;
  switch (answer.kind) {
    case "score":
      return answer.score == null ? null : answer.score.toFixed(2);
    case "noul":
      return formatPercent(answer.probability);
    case "refusal":
      return "Refused";
    default:
      return null;
  }
}

export function answerConfidence(
  answer: NormalizedDecisionAnswer | undefined
): number | null {
  return answer && (answer.kind === "choice" || answer.kind === "score")
    ? answer.confidence
    : null;
}

export function formatUsage(
  model: string | null,
  usage: { input: number | null; output: number | null }
): string {
  const parts = [
    model,
    usage.input != null ? `${usage.input} in` : null,
    usage.output != null ? `${usage.output} out` : null,
  ].filter((part): part is string => part != null);
  return parts.length ? parts.join(" · ") : "usage unavailable";
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
          gap: var(--global-dimension-size-200);
        `}
        aria-label="Decision answers"
      >
        {result.answers.map((answer) => {
          const confidence = answerConfidence(answer);
          const headline = answerHeadline(answer);
          return (
            <li key={answer.name}>
              <Flex direction="column" gap="size-75">
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                  gap="size-100"
                >
                  <Text weight="heavy" css={wrapAnywhereCSS}>
                    {answer.name}
                  </Text>
                  <Flex direction="row" gap="size-100" alignItems="baseline">
                    {confidence != null ? (
                      <Text size="XS" color="text-700">
                        confidence {formatPercent(confidence)}
                      </Text>
                    ) : null}
                    {headline != null ? (
                      <Text
                        weight="heavy"
                        data-testid={`answer-${answer.name}`}
                      >
                        {headline}
                      </Text>
                    ) : (
                      <span data-testid={`answer-${answer.name}`} hidden>
                        {answer.kind === "choice" ? answer.choice : ""}
                      </span>
                    )}
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
        {formatUsage(result.model, result.usage)}
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
