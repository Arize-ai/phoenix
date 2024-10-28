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
          ... on ProjectSession {
            traces {
              edges {
                trace: node {
                  rootSpan {
                    input {
                      value
                    }
                    output {
                      value
                    }
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
    const gqlSpans = data.session?.traces?.edges || [];
    return gqlSpans.map(({ trace }) => trace);
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
          {spansList.map((trace, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{trace.rootSpan?.input?.value}</td>
              <td>{trace.rootSpan?.output?.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
