import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Flex,
  IDBadge,
  Text,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

import { ExperimentCompareLaneEmpty } from "./ExperimentCompareLaneEmpty";
import { getMissingRunMessage } from "./experimentCompareLaneRuns";
import type { CompareLane } from "./experimentCompareLaneTypes";
import { useCompareLaneRun } from "./useExperimentCompareLaneRunGroup";

const identifiersCSS = css`
  padding: 0 var(--global-dimension-size-100);
  min-height: var(--global-dimension-size-300);
`;

/**
 * A lane's Metadata cell: the shown run's and its trace's IDs over the
 * experiment's metadata.
 */
export function ExperimentCompareLaneMetadata({
  exampleId,
  lane,
}: {
  exampleId: string;
  lane: CompareLane;
}) {
  const { runState, shownRun } = useCompareLaneRun({ exampleId, lane });
  const metadataText = JSON.stringify(lane.experiment.metadata, null, 2);
  return (
    <Flex direction="column" gap="size-100">
      {shownRun != null ? (
        <Flex
          direction="row"
          gap="size-200"
          alignItems="center"
          wrap
          css={identifiersCSS}
        >
          <Flex direction="row" gap="size-50" alignItems="center">
            <Text size="S" color="text-500">
              run
            </Text>
            <IDBadge
              id={shownRun.id}
              variant="quiet"
              tooltipText="Copy run ID"
            />
          </Flex>
          {shownRun.trace != null ? (
            <Flex direction="row" gap="size-50" alignItems="center">
              <Text size="S" color="text-500">
                trace
              </Text>
              <IDBadge
                id={shownRun.trace.traceId}
                variant="quiet"
                tooltipText="Copy trace ID"
              />
            </Flex>
          ) : null}
        </Flex>
      ) : (
        <ExperimentCompareLaneEmpty
          message={getMissingRunMessage(
            runState.type === "pending" ? "pending" : "no-runs"
          )}
        />
      )}
      <Card
        title="Experiment Metadata"
        extra={<CopyToClipboardButton text={metadataText} />}
      >
        <JSONBlock value={metadataText} />
      </Card>
    </Flex>
  );
}
