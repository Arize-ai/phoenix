import { fetchQuery, graphql } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { traceRedirectLoaderQuery } from "./__generated__/traceRedirectLoaderQuery.graphql";

export async function traceRedirectLoader({ params }: LoaderFunctionArgs) {
  const { trace_otel_id } = params;

  if (!trace_otel_id) {
    throw new Error("Trace redirect requires a trace ID");
  }

  const response = await fetchQuery<traceRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query traceRedirectLoaderQuery($traceOtelId: String!) {
        trace: getTraceByOtelId(traceId: $traceOtelId) {
          project {
            id
          }
        }
      }
    `,
    {
      traceOtelId: trace_otel_id,
    }
  ).toPromise();

  if (response?.trace) {
    const { project } = response.trace;
    // encode the trace ID because the ingested value is not guaranteed to be
    // path-safe; a path- or protocol-relative value would otherwise escape the
    // intended route
    return redirect(
      `/projects/${project.id}/traces/${encodeURIComponent(trace_otel_id)}`
    );
  } else {
    throw new Error(`Trace with id "${trace_otel_id}" not found`);
  }
}
