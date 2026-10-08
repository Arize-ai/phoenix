import { css } from "@emotion/react";
import { Suspense, useMemo, useState } from "react";

import {
  Alert,
  Card,
  CopyToClipboardButton,
  Flex,
  ParagraphSkeleton,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { ExperimentRepetitionSelector } from "@phoenix/pages/experiment/ExperimentRepetitionSelector";

import { DecisionResult } from "./DecisionResult";
import { RunMetadataFooter } from "./RunMetadataFooter";
import { TitleWithAlphabeticIndex } from "./TitleWithAlphabeticIndex";
import type { PlaygroundInstanceProps } from "./types";
import { useDecisionRunner } from "./useDecisionRunner";

type DecisionDisplayMode = "pretty" | "raw";

// The chat output paints its editor over the AI tint with this translucent
// layer; the distributions sit on the same layer so both modes share one
// body color under the card header.
const prettyBodyCSS = css`
  padding: var(--global-dimension-size-200);
  background-color: var(--code-mirror-editor-background-color);
`;

function prettyPrint(output: string): string {
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
}

/**
 * Output for one decision instance, shaped like the chat output: an Output
 * card holding one answers card whose header toggles between the
 * distributions and the raw response, with the run footer below.
 */
export function PlaygroundDecisionOutput({
  playgroundInstanceId: instanceId,
}: PlaygroundInstanceProps) {
  useDecisionRunner(instanceId);
  const store = usePlaygroundStore();
  const instance = usePlaygroundContext((state) =>
    state.instances.find((item) => item.id === instanceId)
  );
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((item) => item.id === instanceId)
  );
  const [mode, setMode] = useState<DecisionDisplayMode>("pretty");
  // The response is the model's turn, so it takes the AI message tint.
  const answersStyles = useChatMessageStyles("ai");
  const selected = instance?.repetitions[instance.selectedRepetitionNumber];
  const output = typeof selected?.output === "string" ? selected.output : null;
  const raw = useMemo(
    () => (output == null ? "" : prettyPrint(output)),
    [output]
  );
  if (!instance) return null;
  const request = instance.decisionRequest ?? null;
  const runId = instance.activeRunId;
  const totalRepetitions = Object.keys(instance.repetitions).length;
  const skeletonLines = Math.max(1, request?.questions.length ?? 0);
  return (
    <Card
      title={<TitleWithAlphabeticIndex index={index} title="Output" />}
      extra={
        totalRepetitions > 1 ? (
          <ExperimentRepetitionSelector
            repetitionNumber={instance.selectedRepetitionNumber}
            totalRepetitions={totalRepetitions}
            setRepetitionNumber={(next) =>
              store
                .getState()
                .setSelectedRepetitionNumber(
                  instanceId,
                  typeof next === "function"
                    ? next(instance.selectedRepetitionNumber)
                    : next
                )
            }
          />
        ) : undefined
      }
    >
      <View padding="size-200">
        {selected?.error ? (
          <div role="alert">
            <Alert variant="danger">{selected.error.message}</Alert>
          </div>
        ) : output != null ? (
          <Card
            title="answers"
            {...answersStyles}
            extra={
              <Flex direction="row" gap="size-100" alignItems="center">
                <SegmentedControl
                  aria-label="Answer display"
                  size="S"
                  selectedKey={mode}
                  onSelectionChange={(key) =>
                    setMode(key === "raw" ? "raw" : "pretty")
                  }
                >
                  <SegmentedControlItem id="pretty">
                    Pretty
                  </SegmentedControlItem>
                  <SegmentedControlItem id="raw">Raw</SegmentedControlItem>
                </SegmentedControl>
                <CopyToClipboardButton text={raw} />
              </Flex>
            }
          >
            {mode === "pretty" ? (
              <div css={prettyBodyCSS}>
                <DecisionResult output={output} request={request} />
              </div>
            ) : (
              <JSONBlock value={raw} />
            )}
          </Card>
        ) : runId != null ? (
          <ParagraphSkeleton lines={skeletonLines * 2} />
        ) : (
          <Text color="text-700">
            Run the decision model to see each answer&rsquo;s probabilities,
            confidence, and usage.
          </Text>
        )}
      </View>
      {selected?.spanId ? (
        <Suspense>
          <RunMetadataFooter spanId={selected.spanId} />
        </Suspense>
      ) : null}
    </Card>
  );
}
