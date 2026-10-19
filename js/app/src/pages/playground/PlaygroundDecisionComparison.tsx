import { css } from "@emotion/react";
import { Suspense, useMemo } from "react";

import { Alert, Button, Flex, Loading, Text, View } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground/types";

import { DecisionAnswerView } from "./DecisionResult";
import {
  type NormalizedDecisionAnswer,
  normalizeDecisionResult,
} from "./decisionUtils";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { useDecisionRunner } from "./useDecisionRunner";

const gridCSS = css`
  display: grid;
  gap: 0;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  overflow: hidden;
  > * {
    min-width: 0;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
    border-bottom: 1px solid var(--global-border-color-default);
  }
  > [data-row-end="true"] {
    border-right: none;
  }
  > [data-last-row="true"] {
    border-bottom: none;
  }
  > [data-column-divider="true"] {
    border-left: 1px solid var(--global-border-color-default);
  }
  > [data-header="true"] {
    background: var(--global-background-color-light);
  }
`;

/** Runs one instance's request without rendering anything. */
function DecisionRunner({ instanceId }: { instanceId: number }) {
  useDecisionRunner(instanceId);
  return null;
}

function headline(answer: NormalizedDecisionAnswer | undefined): string {
  if (!answer) return "–";
  switch (answer.kind) {
    case "choice":
      return answer.choice ?? "–";
    case "score":
      return answer.score == null ? "–" : answer.score.toFixed(2);
    case "noul":
      return answer.probability == null
        ? "–"
        : `${Math.round(answer.probability * 100)}%`;
    case "refusal":
      return "Refused";
    default:
      return "–";
  }
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
  const questionNames = useMemo(
    () => (request?.questions ?? []).map((q) => q.name.trim()).filter(Boolean),
    [request]
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
  const columnCount = columns.length;
  const style = {
    gridTemplateColumns: `minmax(10em, 0.8fr) repeat(${columnCount}, minmax(0, 1fr))`,
  };

  return (
    <>
      {instances.map((instance) => (
        <DecisionRunner key={instance.id} instanceId={instance.id} />
      ))}
      <div
        css={gridCSS}
        style={style}
        role="table"
        aria-label="Decision comparison"
      >
        <div role="columnheader" data-header="true">
          <Text size="S" color="text-700">
            Question
          </Text>
        </div>
        {columns.map(({ instance, selected }, i) => (
          <div
            key={instance.id}
            role="columnheader"
            data-header="true"
            data-column-divider="true"
            data-row-end={i === columnCount - 1}
          >
            <Flex direction="column" gap="size-75">
              <Flex
                direction="row"
                gap="size-100"
                alignItems="center"
                justifyContent="space-between"
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <AlphabeticIndexIcon index={i} />
                  <GenerativeProviderIcon
                    provider={instance.model.provider}
                    height={16}
                  />
                  <Text weight="heavy">
                    {instance.model.modelName ?? "model"}
                  </Text>
                </Flex>
                {instance.activeRunId != null ? <Loading size="S" /> : null}
              </Flex>
              {Object.keys(instance.repetitions).length > 1 ? (
                <Flex direction="row" gap="size-50" wrap>
                  {Object.keys(instance.repetitions).map((number) => (
                    <Button
                      key={number}
                      size="S"
                      variant={
                        Number(number) === instance.selectedRepetitionNumber
                          ? "primary"
                          : "default"
                      }
                      onPress={() =>
                        store
                          .getState()
                          .setSelectedRepetitionNumber(
                            instance.id,
                            Number(number)
                          )
                      }
                    >
                      Run {number}
                    </Button>
                  ))}
                </Flex>
              ) : null}
              {selected?.error ? (
                <div role="alert">
                  <Alert variant="danger">{selected.error.message}</Alert>
                </div>
              ) : null}
            </Flex>
          </div>
        ))}
        {rows.map((name, rowIndex) => {
          const isLast = rowIndex === rows.length - 1;
          return [
            <div key={`${name}-label`} role="rowheader" data-last-row={isLast}>
              <Text
                weight="heavy"
                css={css`
                  overflow-wrap: anywhere;
                `}
              >
                {name}
              </Text>
            </div>,
            ...columns.map(({ instance, result }, i) => {
              const answer = result?.answers.find((a) => a.name === name);
              const confidence =
                answer && (answer.kind === "choice" || answer.kind === "score")
                  ? answer.confidence
                  : null;
              return (
                <div
                  key={`${name}-${instance.id}`}
                  role="cell"
                  data-column-divider="true"
                  data-row-end={i === columnCount - 1}
                  data-last-row={isLast}
                >
                  {answer ? (
                    <Flex direction="column" gap="size-75">
                      <Flex
                        direction="row"
                        justifyContent="space-between"
                        alignItems="baseline"
                        gap="size-100"
                      >
                        <Text weight="heavy" data-testid={`answer-${name}`}>
                          {headline(answer)}
                        </Text>
                        {confidence != null ? (
                          <Text size="XS" color="text-700">
                            confidence {Math.round(confidence * 100)}%
                          </Text>
                        ) : null}
                      </Flex>
                      <DecisionAnswerView answer={answer} />
                    </Flex>
                  ) : (
                    <Text size="S" color="text-700">
                      {instance.activeRunId != null ? "Running…" : "–"}
                    </Text>
                  )}
                </div>
              );
            }),
          ];
        })}
        <div role="cell" data-last-row="true">
          <Text size="XS" color="text-700">
            Usage
          </Text>
        </div>
        {columns.map(({ instance, selected, result }, i) => (
          <div
            key={`${instance.id}-footer`}
            role="cell"
            data-column-divider="true"
            data-row-end={i === columnCount - 1}
            data-last-row="true"
          >
            <Flex direction="column" gap="size-75">
              <Text
                size="XS"
                color="text-700"
                css={css`
                  font-variant-numeric: tabular-nums;
                `}
              >
                {result
                  ? `${result.model ?? instance.model.modelName ?? ""} · ${result.usage.input ?? "?"} in · ${result.usage.output ?? "?"} out`
                  : "–"}
              </Text>
              {selected?.spanId ? (
                <Suspense>
                  <RunMetadataFooter
                    spanId={selected.spanId}
                    hideTokenMetrics
                  />
                </Suspense>
              ) : null}
            </Flex>
          </div>
        ))}
      </div>
      <View paddingTop="size-100">
        <Text size="XS" color="text-700">
          Bars show the probability the model assigned to each option or level.
          Scores are the provider&rsquo;s weighted position on your scale; the
          nearest level is emphasized.
        </Text>
      </View>
    </>
  );
}
