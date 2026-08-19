import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { spanRedirectLoaderQuery } from "./__generated__/spanRedirectLoaderQuery.graphql";

export async function spanRedirectLoader({ params }: LoaderFunctionArgs) {
  const { span_otel_id } = params;

  if (!span_otel_id) {
    throw new Error("Span redirect requires a span ID");
  }

  const response = await fetchQuery<spanRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query spanRedirectLoaderQuery($spanOtelId: String!) {
        span: getSpanByOtelId(spanId: $spanOtelId) {
          id
          trace {
            traceId
          }
          project {
            id
          }
        }
      }
    `,
    {
      spanOtelId: span_otel_id,
    }
  ).toPromise();

  if (response?.span) {
    const { id: spanId, trace, project } = response.span;
    // encode the trace ID because the ingested value is not guaranteed to be
    // path-safe; a path- or protocol-relative value would otherwise escape the
    // intended route
    return redirect(
      `/projects/${project.id}/spans/${encodeURIComponent(trace.traceId)}?selectedSpanNodeId=${encodeURIComponent(spanId)}`
    );
  } else {
    throw new Error(`Span with id "${span_otel_id}" not found`);
  }
}
