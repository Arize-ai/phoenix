import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { Card, CardProps, Dialog, Flex, View } from "@arizeai/components";

import { CopyToClipboardButton } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";

import type { PlaygroundExperimentRunDetailsDialogQuery } from "./__generated__/PlaygroundExperimentRunDetailsDialogQuery.graphql";

/**
 * A slide-over that shows the details of a playground experiment run.
 */
export function PlaygroundExperimentRunDetailsDialog({
  runId,
}: {
  runId: string;
}) {
  const data = useLazyLoadQuery<PlaygroundExperimentRunDetailsDialogQuery>(
    graphql`
      query PlaygroundExperimentRunDetailsDialogQuery($runId: GlobalID!) {
        run: node(id: $runId) {
          ... on ExperimentRun {
            output
            example {
              id
              revision {
                input
                output
              }
            }
          }
        }
      }
    `,
    { runId }
  );
  const run = useMemo(() => {
    const run = data.run;
    const example = run.example;
    const revision = example?.revision;
    return {
      exampleId: example?.id,
      input: JSON.stringify(revision?.input, null, 2),
      referenceOutput: JSON.stringify(revision?.output, null, 2),
      runOutput:
        run.output !== null ? JSON.stringify(run.output, null, 2) : null,
    };
  }, [data]);
  const { exampleId, input, referenceOutput, runOutput } = run;
  return (
    <Dialog size="XL" title={`Experiment Run for Example: ${exampleId}`}>
      <Flex direction="row" justifyContent="center">
        <View
          width="900px"
          paddingStart="auto"
          paddingEnd="auto"
          paddingTop="size-200"
          paddingBottom="size-200"
        >
          <Flex direction="column" gap="size-200">
            <Card
              title="Input"
              {...defaultCardProps}
              extra={<CopyToClipboardButton text={input} />}
            >
              <JSONBlock value={input} />
            </Card>
            <Card
              title="Reference Output"
              {...defaultCardProps}
              extra={<CopyToClipboardButton text={referenceOutput} />}
            >
              <JSONBlock value={referenceOutput} />
            </Card>
            {runOutput && (
              <Card
                title="Run Output"
                {...defaultCardProps}
                extra={<CopyToClipboardButton text={runOutput} />}
              >
                <JSONBlock value={runOutput} />
              </Card>
            )}
          </Flex>
        </View>
      </Flex>
    </Dialog>
  );
}

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  variant: "compact",
  collapsible: true,
  bodyStyle: {
    padding: 0,
  },
};
