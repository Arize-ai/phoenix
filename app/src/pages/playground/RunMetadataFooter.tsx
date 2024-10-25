import React, { ReactNode, startTransition, Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Button,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";

import { RunMetadataFooterQuery } from "./__generated__/RunMetadataFooterQuery.graphql";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";

export function RunMetadataFooter({ spanId }: { spanId: string }) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const data = useLazyLoadQuery<RunMetadataFooterQuery>(
    graphql`
      query RunMetadataFooterQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          id
          ... on Span {
            project {
              id
            }
            context {
              traceId
              spanId
            }
            tokenCountCompletion
            tokenCountPrompt
            tokenCountTotal
            latencyMs
          }
        }
      }
    `,
    { spanId }
  );

  if (!data.span || !data.span.project || !data.span.context) {
    return null;
  }
  const {
    project,
    context: { traceId },
  } = data.span;

  return (
    <View
      borderTopColor="light"
      borderTopWidth="thin"
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-100"
      paddingBottom="size-100"
    >
      <Flex direction="row" gap="size-200" justifyContent="space-between">
        <Flex direction="row" gap="size-100" alignItems="center">
          <TokenCount
            tokenCountTotal={data.span.tokenCountTotal || 0}
            tokenCountPrompt={data.span.tokenCountPrompt || 0}
            tokenCountCompletion={data.span.tokenCountCompletion || 0}
          />
          <LatencyText latencyMs={data.span.latencyMs || 0} />
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center">
          <Button
            size="compact"
            variant="default"
            icon={<Icon svg={<Icons.EditOutline />} />}
            onClick={() =>
              setDialog(
                <EditSpanAnnotationsDialog
                  spanNodeId={spanId}
                  projectId={project.id}
                />
              )
            }
          >
            Annotate
          </Button>
          <Button
            size="compact"
            variant="default"
            icon={<Icon svg={<Icons.Trace />} />}
            onClick={() => {
              startTransition(() => {
                setDialog(
                  <Suspense>
                    <PlaygroundRunTraceDetailsDialog
                      traceId={traceId}
                      projectId={project.id}
                      title={`Playground Trace`}
                    />
                  </Suspense>
                );
              });
            }}
          >
            View Trace
          </Button>
        </Flex>
      </Flex>
      <DialogContainer
        type="slideOver"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </View>
  );
}
