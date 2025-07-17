import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";
import { graphql } from "relay-runtime";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

import { RunMetadataFooterQuery } from "./__generated__/RunMetadataFooterQuery.graphql";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";

export function RunMetadataFooter({ spanId }: { spanId: string }) {
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
            tokenCountTotal
            latencyMs
            costSummary {
              total {
                cost
              }
            }
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
  const totalCost = data.span.costSummary?.total?.cost;

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
          <LatencyText size="S" latencyMs={data.span.latencyMs || 0} />
          <SpanTokenCount
            tokenCountTotal={data.span.tokenCountTotal || 0}
            nodeId={data.span.id}
            size="S"
          />
          {totalCost != null && (
            <SpanTokenCosts
              totalCost={totalCost}
              spanNodeId={data.span.id}
              size="S"
            />
          )}
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center">
          <DialogTrigger>
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.EditOutline />} />}
            >
              Annotate
            </Button>
            <ModalOverlay>
              <Modal variant="slideover" size="S">
                <EditSpanAnnotationsDialog
                  spanNodeId={spanId}
                  projectId={trace.project.id}
                />
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
          <DialogTrigger
            onOpenChange={(open) => {
              if (!open) {
                setSearchParams((searchParams) => {
                  searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
                  return searchParams;
                });
              }
            }}
          >
            <Button size="S" leadingVisual={<Icon svg={<Icons.Trace />} />}>
              View Trace
            </Button>
            <ModalOverlay>
              <Modal variant="slideover" size="fullscreen">
                <Suspense fallback={<Loading />}>
                  <PlaygroundRunTraceDetailsDialog
                    traceId={trace.traceId}
                    projectId={trace.project.id}
                    title={`Playground Trace`}
                  />
                </Suspense>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </Flex>
      </Flex>
    </View>
  );
}
