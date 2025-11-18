import { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";

import { Button, Flex, Text, View } from "@phoenix/components";
import { TraceTree, TraceTreeProps } from "@phoenix/components/trace/TraceTree";

import { ConnectedTraceTree$key } from "./__generated__/ConnectedTraceTree.graphql";
import { ConnectedTraceTreeQuery } from "./__generated__/ConnectedTraceTreeQuery.graphql";

type ConnectedTraceTreeProps = {
  trace: ConnectedTraceTree$key;
} & Omit<TraceTreeProps, "spans">;
/**
 * A TraceTree that is connected to relay via data fetching
 */
export function ConnectedTraceTree(props: ConnectedTraceTreeProps) {
  const { data, hasNext } = usePaginationFragment<
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

  return (
    <Flex direction="column" flex="1 1 auto" height="100%">
      <TraceTree spans={spansList} {...props} />
      <View
        padding="size-100"
        borderTopColor="grey-300"
        borderTopWidth="thin"
        flex="none"
      >
        <Flex direction="row">
          <Text>Viewing {spansList.length} spans.</Text>
          {hasNext ? <Button size="S">Load More</Button> : null}
        </Flex>
      </View>
    </Flex>
  );
}
