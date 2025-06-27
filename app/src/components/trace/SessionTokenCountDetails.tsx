import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { SessionTokenCountDetailsQuery } from "./__generated__/SessionTokenCountDetailsQuery.graphql";
import { TokenCountDetails } from "./TokenCountDetails";

export function SessionTokenCountDetails(props: { sessionNodeId: string }) {
  const data = useLazyLoadQuery<SessionTokenCountDetailsQuery>(
    graphql`
      query SessionTokenCountDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on ProjectSession {
            tokenUsage {
              prompt
              completion
            }
          }
        }
      }
    `,
    { nodeId: props.sessionNodeId }
  );

  const tokenData = useMemo(() => {
    if (data.node.__typename === "ProjectSession") {
      const sessionPrompt = data.node.tokenUsage.prompt;
      const sessionCompletion = data.node.tokenUsage.completion;
      return {
        total: sessionPrompt + sessionCompletion,
        prompt: sessionPrompt,
        completion: sessionCompletion,
      };
    }

    return {
      total: null,
      prompt: null,
      completion: null,
    };
  }, [data.node]);

  return <TokenCountDetails {...tokenData} />;
}
