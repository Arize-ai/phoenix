import { ReactNode, startTransition, Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";
import { graphql } from "relay-runtime";

import { DialogContainer } from "@arizeai/components";

import { Button, Flex, Icon, Icons, View } from "@phoenix/components";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

import { RunMetadataFooterQuery } from "./__generated__/RunMetadataFooterQuery.graphql";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";

export function RunMetadataFooter({ spanId }: { spanId: string }) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<RunMetadataFooterQuery>(
    graphql`
      query RunMetadataFooterQuery($spanId: ID!) {
        span: node(id: $spanId) {
          id
          ... on Span {
            spanId
            trace {
              id
              traceId
              project {
                id
              }
            }
            tokenCountCompletion
            tokenCountPrompt
            tokenCountTotal
            latencyMs
          }
        }
      }
    `,
    { spanId },
    {
      fetchPolicy: "store-and-network",
    }
  );
  if (!data.span || !data.span.trace || !data.span.trace.project) {
    return null;
  }
  const { trace } = data.span;

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
            size="S"
            leadingVisual={<Icon svg={<Icons.EditOutline />} />}
            onPress={() =>
              setDialog(
                <EditSpanAnnotationsDialog
                  spanNodeId={spanId}
                  projectId={trace.project.id}
                />
              )
            }
          >
            Annotate
          </Button>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.Trace />} />}
            onPress={() => {
              startTransition(() => {
                setDialog(
                  <Suspense>
                    <PlaygroundRunTraceDetailsDialog
                      traceId={trace.traceId}
                      projectId={trace.project.id}
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
        onDismiss={() => {
          setDialog(null);
          setSearchParams((searchParams) => {
            searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
            return searchParams;
          });
        }}
      >
        {dialog}
      </DialogContainer>
    </View>
  );
}
