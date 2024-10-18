import React from "react";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, View } from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";

import { RunMetadataFooterQuery } from "./__generated__/RunMetadataFooterQuery.graphql";

export function RunMetadataFooter({ spanId }: { spanId: string }) {
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

  if (!data.span) {
    return null;
  }

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
        <Flex direction="row" gap="size-100">
          <TokenCount
            tokenCountTotal={data.span.tokenCountTotal || 0}
            tokenCountPrompt={data.span.tokenCountPrompt || 0}
            tokenCountCompletion={data.span.tokenCountCompletion || 0}
          />
          <LatencyText latencyMs={data.span.latencyMs || 0} />
        </Flex>
        <ExternalLink
          href={`/projects/${data.span?.project?.id}/traces/${data.span?.context?.traceId}?selectedSpanId=${data.span?.context?.spanId}`}
        >
          View Trace
        </ExternalLink>
      </Flex>
    </View>
  );
}
