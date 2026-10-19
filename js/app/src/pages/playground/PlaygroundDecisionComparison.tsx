import { css } from "@emotion/react";
import { Suspense, useMemo } from "react";

import {
  Alert,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  ParagraphSkeleton,
  Text,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { ExperimentRepetitionSelector } from "@phoenix/pages/experiment/ExperimentRepetitionSelector";
import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground/types";

import {
  answerConfidence,
  answerHeadline,
  DecisionAnswerView,
  formatPercent,
  formatUsage,
} from "./DecisionResult";
import { normalizeDecisionResult } from "./decisionUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { useDecisionRunner } from "./useDecisionRunner";

const comparisonTableCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  overflow: hidden;
  table-layout: fixed;
  th,
  td {
    vertical-align: top;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    text-align: left;
  }
  th.comparison__question-column {
    width: 16em;
  }
  td.comparison__footer {
    // RunMetadataFooter owns its padding and top border.
    padding: 0;
  }
  tbody tr:last-of-type > td {
    border-bottom: none;
  }
`;

const wrapAnywhereCSS = css`
  overflow-wrap: anywhere;
`;

/** Runs one instance's request without rendering anything. */
function DecisionRunner({ instanceId }: { instanceId: number }) {
  useDecisionRunner(instanceId);
  return null;
}

/**
 * Side-by-side output when every instance is a decision model: one row per
 * question, one column per model, so the eye scans the same question across
 * models. Each column still owns its repetitions, errors, and trace link.
 */
export function PlaygroundDecisionComparison({
  instances,
}: {
  instances: PlaygroundNormalizedInstance[];
}) {
  const store = usePlaygroundStore();
  const request = usePlaygroundContext((state) => state.decisionRequest);
  const questions = useMemo(() => request?.questions ?? [], [request]);
  const questionNames = useMemo(
    () => questions.map((q) => q.name.trim()).filter(Boolean),
    [questions]
  );
  const columns = useMemo(
    () =>
      instances.map((instance) => {
        const selected =
          instance.repetitions[instance.selectedRepetitionNumber];
        let result: ReturnType<typeof normalizeDecisionResult> | null = null;
        if (typeof selected?.output === "string") {
          try {
            result = normalizeDecisionResult(
              JSON.parse(selected.output),
              request
            );
          } catch {
            result = null;
          }
        }
        return { instance, selected, result };
      }),
    [instances, request]
  );
  // Answers the provider returned that the current request no longer asks for.
  const extraNames = useMemo(() => {
    const names = new Set<string>();
    for (const column of columns) {
      column.result?.answers.forEach((a) => {
        if (!questionNames.includes(a.name)) names.add(a.name);
      });
    }
    return Array.from(names);
  }, [columns, questionNames]);
  const rows = [...questionNames, ...extraNames];

  return (
    <Flex direction="column" gap="size-100">
      {instances.map((instance) => (
        <DecisionRunner key={instance.id} instanceId={instance.id} />
      ))}
      <table
        css={css(tableCSS, borderedTableCSS, comparisonTableCSS)}
        aria-label="Decision comparison"
      >
        <thead>
          <tr>
            <th scope="col" className="comparison__question-column">
              <Text size="S" color="text-700">
                Question
              </Text>
            </th>
            {columns.map(({ instance, selected }, i) => (
              <th scope="col" key={instance.id}>
                <Flex direction="column" gap="size-75">
                  <Flex
                    direction="row"
                    gap="size-100"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Flex
                      direction="row"
                      gap="size-100"
                      alignItems="center"
                      minWidth={0}
                    >
                      <AlphabeticIndexIcon index={i} />
                      <GenerativeProviderIcon
                        provider={instance.model.provider}
                        height={16}
                      />
                      <Text weight="heavy" css={wrapAnywhereCSS}>
                        {instance.model.modelName ?? "model"}
                      </Text>
                    </Flex>
                    {Object.keys(instance.repetitions).length > 1 ? (
                      <ExperimentRepetitionSelector
                        repetitionNumber={instance.selectedRepetitionNumber}
                        totalRepetitions={
                          Object.keys(instance.repetitions).length
                        }
                        setRepetitionNumber={(next) =>
                          store
                            .getState()
                            .setSelectedRepetitionNumber(
                              instance.id,
                              typeof next === "function"
                                ? next(instance.selectedRepetitionNumber)
                                : next
                            )
                        }
                      />
                    ) : null}
                  </Flex>
                  {selected?.error ? (
                    <div role="alert">
                      <Alert variant="danger">{selected.error.message}</Alert>
                    </div>
                  ) : null}
                </Flex>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((name) => {
            const question = questions.find((q) => q.name.trim() === name);
            const skeletonLines =
              question?.type === "choice"
                ? question.choices.length
                : question?.type === "score"
                  ? question.levels.length
                  : 1;
            return (
              <tr key={name}>
                <th scope="row">
                  <Text weight="heavy" css={wrapAnywhereCSS}>
                    {name}
                  </Text>
                </th>
                {columns.map(({ instance, result }) => {
                  const answer = result?.answers.find((a) => a.name === name);
                  const headline = answerHeadline(answer);
                  const confidence = answerConfidence(answer);
                  return (
                    <td key={`${name}-${instance.id}`}>
                      {answer ? (
                        <Flex direction="column" gap="size-75">
                          {headline != null || confidence != null ? (
                            <Flex
                              direction="row"
                              justifyContent={
                                headline != null ? "space-between" : "end"
                              }
                              alignItems="baseline"
                              gap="size-100"
                            >
                              {headline != null ? (
                                <Text
                                  weight="heavy"
                                  data-testid={`answer-${name}`}
                                >
                                  {headline}
                                </Text>
                              ) : (
                                <span data-testid={`answer-${name}`} hidden>
                                  {answer.kind === "choice"
                                    ? answer.choice
                                    : ""}
                                </span>
                              )}
                              {confidence != null ? (
                                <Text size="XS" color="text-700">
                                  confidence {formatPercent(confidence)}
                                </Text>
                              ) : null}
                            </Flex>
                          ) : (
                            <span data-testid={`answer-${name}`} hidden>
                              {answer.kind === "choice" ? answer.choice : ""}
                            </span>
                          )}
                          <DecisionAnswerView answer={answer} />
                        </Flex>
                      ) : instance.activeRunId != null ? (
                        <ParagraphSkeleton lines={Math.max(1, skeletonLines)} />
                      ) : (
                        <Text size="S" color="text-700">
                          –
                        </Text>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <th scope="row">
              <Text size="XS" color="text-700">
                Usage
              </Text>
            </th>
            {columns.map(({ instance, selected, result }) => (
              <td key={`${instance.id}-footer`} className="comparison__footer">
                <View padding="size-150" paddingX="size-200">
                  <Text
                    size="XS"
                    color="text-700"
                    css={css`
                      font-variant-numeric: tabular-nums;
                    `}
                  >
                    {result
                      ? formatUsage(
                          result.model ?? instance.model.modelName,
                          result.usage
                        )
                      : "–"}
                  </Text>
                </View>
                {selected?.spanId ? (
                  <Suspense>
                    <RunMetadataFooter
                      spanId={selected.spanId}
                      hideTokenMetrics
                    />
                  </Suspense>
                ) : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <Disclosure
        id="decision-comparison-help"
        size="S"
        defaultExpanded={false}
      >
        <DisclosureTrigger>How to read this</DisclosureTrigger>
        <DisclosurePanel>
          <Text size="XS" color="text-700">
            Bars show the probability the model assigned to each option or
            level. Scores are the provider&rsquo;s weighted position on your
            scale; the nearest level is emphasized. Confidence is the
            provider&rsquo;s own measure of how peaked the distribution is.
          </Text>
        </DisclosurePanel>
      </Disclosure>
    </Flex>
  );
}
