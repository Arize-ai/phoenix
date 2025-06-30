import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { traceRedirectLoaderQuery } from "./__generated__/traceRedirectLoaderQuery.graphql";

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
    return redirect(`/projects/${project.id}/traces/${trace_otel_id}`);
  } else {
    throw new Error(`Trace with id "${trace_otel_id}" not found`);
  }
}
