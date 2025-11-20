import { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";

import { Alert, Button, Flex } from "@phoenix/components";
import { TraceTree, TraceTreeProps } from "@phoenix/components/trace/TraceTree";

import { ConnectedTraceTree$key } from "./__generated__/ConnectedTraceTree.graphql";
import { ConnectedTraceTreeQuery } from "./__generated__/ConnectedTraceTreeQuery.graphql";

type ConnectedTraceTreeProps = {
  trace: ConnectedTraceTree$key;
} & Omit<TraceTreeProps, "spans">;

const PAGE_SIZE = 1000;
/**
 * A TraceTree that is connected to relay via data fetching
 */
export function ConnectedTraceTree(props: ConnectedTraceTreeProps) {
  const { data, hasNext, loadNext } = usePaginationFragment<
    ConnectedTraceTreeQuery,
    ConnectedTraceTree$key
  >(
    graphql`
      fragment ConnectedTraceTree on Trace
      @refetchable(queryName: "ConnectedTraceTreeQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 1000 }
        cursor: { type: "String", defaultValue: null }
      ) {
        numSpans
        spans(first: $count, after: $cursor)
          @connection(key: "ConnectedTraceTree_spans") {
          edges {
            span: node {
              id
              spanId
              name
              spanKind
              statusCode
              startTime
              endTime
              parentId
              latencyMs
              tokenCountTotal
              spanAnnotationSummaries {
                labels
                count
                labelCount
                labelFractions {
                  fraction
                  label
                }
                name
                scoreCount
                meanScore
              }
            }
          }
        }
      }
    `,
    props.trace
  );
  const spansList = useMemo(() => {
    const gqlSpans = data?.spans.edges || [];
    return gqlSpans.map((node) => node.span);
  }, [data]);

  const totalSpans = data?.numSpans;
  const totalSpansViewing = spansList.length;
  return (
    <Flex direction="column" flex="1 1 auto" height="100%">
      {hasNext ? (
        <Alert
          variant="warning"
          banner
          extra={
            <Button
              size="S"
              variant="primary"
              onPress={() => {
                loadNext(PAGE_SIZE);
              }}
            >
              Load More
            </Button>
          }
        >
          Viewing {totalSpansViewing} of {totalSpans} spans.
        </Alert>
      ) : null}
      <TraceTree spans={spansList} {...props} />
    </Flex>
  );
}
