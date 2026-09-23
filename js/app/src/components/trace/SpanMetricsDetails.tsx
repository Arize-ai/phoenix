import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  usePreloadedQuery,
} from "react-relay";

import type {
  SpanMetricsDetails_span$data,
  SpanMetricsDetails_span$key,
} from "./__generated__/SpanMetricsDetails_span.graphql";
import type { SpanMetricsDetailsQuery as SpanMetricsDetailsQueryType } from "./__generated__/SpanMetricsDetailsQuery.graphql";
import { getTokenCostDetailsFromCostDetails } from "./TokenCostsDetails";
import { getTokenCountDetailsFromCostDetails } from "./TokenCountDetails";
import type { TokenDetailsBreakdownProps } from "./TokenDetailsBreakdown";
import { TokenDetailsBreakdown } from "./TokenDetailsBreakdown";

/**
 * The span fields the metrics details draw. Spread it into any query that
 * already loads a span to render the details without a second round trip.
 */
const SpanMetricsDetailsFragment = graphql`
  fragment SpanMetricsDetails_span on Span {
    tokenCountTotal
    tokenCountPrompt
    tokenCountCompletion
    costSummary {
      total {
        cost
      }
      prompt {
        cost
      }
      completion {
        cost
      }
    }
    costDetailSummaryEntries {
      tokenType
      isPrompt
      value {
        cost
        tokens
      }
    }
  }
`;

/**
 * Loads the metrics details of one span by node id. Pass it to
 * `useQueryLoader` to start the fetch ahead of render, then draw the result
 * with {@link PreloadedSpanMetricsDetails}.
 */
export const SpanMetricsDetailsQuery = graphql`
  query SpanMetricsDetailsQuery($nodeId: ID!) {
    node(id: $nodeId) {
      __typename
      ... on Span {
        ...SpanMetricsDetails_span
      }
    }
  }
`;

/**
 * Maps a span's fragment data onto the plain values the breakdown draws. The
 * breakdown drops a measure with no usage itself, so nothing is filtered here.
 */
function getSpanMetricsDetailsProps(
  span: SpanMetricsDetails_span$data
): TokenDetailsBreakdownProps {
  const costDetails = span.costDetailSummaryEntries;
  return {
    tokens: {
      total: span.tokenCountTotal,
      prompt: span.tokenCountPrompt,
      completion: span.tokenCountCompletion,
      ...getTokenCountDetailsFromCostDetails(costDetails),
    },
    costs: {
      total: span.costSummary?.total?.cost,
      prompt: span.costSummary?.prompt?.cost,
      completion: span.costSummary?.completion?.cost,
      ...getTokenCostDetailsFromCostDetails(costDetails),
    },
  };
}

/**
 * Metrics details for a span whose data the parent already holds. Spread
 * `SpanMetricsDetails_span` into the parent's query or fragment.
 */
export function SpanMetricsDetails(props: {
  span: SpanMetricsDetails_span$key;
}) {
  const span = useFragment(SpanMetricsDetailsFragment, props.span);
  return <TokenDetailsBreakdown {...getSpanMetricsDetailsProps(span)} />;
}

type SpanMetricsDetailsNode = SpanMetricsDetailsQueryType["response"]["node"];

function SpanMetricsDetailsForNode({ node }: { node: SpanMetricsDetailsNode }) {
  if (node.__typename !== "Span") {
    return null;
  }
  return <SpanMetricsDetails span={node} />;
}

/**
 * Metrics details fetched on render for one span by node id.
 *
 * @remarks
 * Suspends while loading, so mount it lazily (inside a tooltip or preview) behind a
 * `Suspense` boundary. A tree of hundreds of spans then fetches details only
 * for the rows the user opens.
 */
export function SpanMetricsDetailsById(props: { spanNodeId: string }) {
  const data = useLazyLoadQuery<SpanMetricsDetailsQueryType>(
    SpanMetricsDetailsQuery,
    { nodeId: props.spanNodeId }
  );
  return <SpanMetricsDetailsForNode node={data.node} />;
}

/**
 * Metrics details from a query reference the parent started with
 * `useQueryLoader(SpanMetricsDetailsQuery)`, for surfaces that want the fetch
 * under way before the details are shown.
 */
export function PreloadedSpanMetricsDetails(props: {
  queryRef: PreloadedQuery<SpanMetricsDetailsQueryType>;
}) {
  const data = usePreloadedQuery<SpanMetricsDetailsQueryType>(
    SpanMetricsDetailsQuery,
    props.queryRef
  );
  return <SpanMetricsDetailsForNode node={data.node} />;
}
