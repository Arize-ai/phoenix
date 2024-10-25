import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { SessionDetailsQuery } from "./__generated__/SessionDetailsQuery.graphql";

export type SessionDetailsProps = {
  sessionId: string;
};

/**
 * A component that shows the details of a session
 */
export function SessionDetails(props: SessionDetailsProps) {
  const { sessionId } = props;
  const data = useLazyLoadQuery<SessionDetailsQuery>(
    graphql`
      query SessionDetailsQuery($id: GlobalID!) {
        session: node(id: $id) {
          ... on ChatSession {
            spans {
              edges {
                span: node {
                  id
                  context {
                    spanId
                    traceId
                  }
                  startTime
                  inputMessage {
                    role
                    content
                  }
                  outputMessage {
                    role
                    content
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      id: sessionId,
    },
    {
      fetchPolicy: "store-and-network",
    }
  );
  const spansList = useMemo(() => {
    const gqlSpans = data.session?.spans?.edges || [];
    return gqlSpans.map(({ span }) => span);
  }, [data]);
  return (
    <main
      css={css`
        flex: 1 1 auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      `}
    >
      <table border={1} cellPadding={20}>
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Assistant</th>
          </tr>
        </thead>
        <tbody>
          {spansList.map((span, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{span.inputMessage?.content}</td>
              <td>{span.outputMessage?.content}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
