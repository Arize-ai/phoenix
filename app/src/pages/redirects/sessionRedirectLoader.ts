import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { sessionRedirectLoaderQuery } from "./__generated__/sessionRedirectLoaderQuery.graphql";

export async function sessionRedirectLoader({ params }: LoaderFunctionArgs) {
  const { session_otel_id } = params;

  if (!session_otel_id) {
    throw new Error("Session redirect requires a session ID");
  }

  const response = await fetchQuery<sessionRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query sessionRedirectLoaderQuery($sessionOtelId: String!) {
        session: getProjectSessionByOtelId(sessionId: $sessionOtelId) {
          projectId
          id
        }
      }
    `,
    {
      sessionOtelId: session_otel_id,
    }
  ).toPromise();

  if (response?.session) {
    const { projectId, id } = response.session;
    return redirect(`/projects/${projectId}/sessions/${id}`);
  } else {
    throw new Error(`Session with id "${session_otel_id}" not found`);
  }
}
