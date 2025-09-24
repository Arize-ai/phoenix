import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs, redirect } from "react-router";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import { sessionRedirectLoaderQuery } from "./__generated__/sessionRedirectLoaderQuery.graphql";

export async function sessionRedirectLoader({ params }: LoaderFunctionArgs) {
  const { session_id: sessionId } = params;

  if (!sessionId) {
    throw new Error("Session redirect requires a session ID");
  }

  const response = await fetchQuery<sessionRedirectLoaderQuery>(
    RelayEnvironment,
    graphql`
      query sessionRedirectLoaderQuery($sessionId: String!) {
        session: getProjectSessionById(sessionId: $sessionId) {
          project {
            id
          }
          id
        }
      }
    `,
    {
      sessionId,
    }
  ).toPromise();

  if (response?.session) {
    const { project, id } = response.session;
    return redirect(`/projects/${project.id}/sessions/${id}`);
  } else {
    throw new Error(`Session with id "${sessionId}" not found`);
  }
}
