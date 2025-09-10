import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { SessionTokenCostsDetailsQuery } from "./__generated__/SessionTokenCostsDetailsQuery.graphql";
import { TokenCostsDetails } from "./TokenCostsDetails";

export function SessionTokenCostsDetails(props: { sessionNodeId: string }) {
  const data = useLazyLoadQuery<SessionTokenCostsDetailsQuery>(
    graphql`
      query SessionTokenCostsDetailsQuery($nodeId: ID!) {
        node(id: $nodeId) {
          __typename
          ... on ProjectSession {
            costDetailSummaryEntries {
              tokenType
              isPrompt
              value {
                cost
                tokens
              }
            }
          }
        }
      }
    `,
    { nodeId: props.sessionNodeId }
  );

  const costData = useMemo(() => {
    if (data.node.__typename === "ProjectSession") {
      const details = data.node.costDetailSummaryEntries;
      if (!details) {
        return {
          total: null,
          prompt: null,
          completion: null,
          promptDetails: null,
          completionDetails: null,
        };
      }

      const promptEntries = details.filter((detail) => detail.isPrompt);
      const completionEntries = details.filter((detail) => !detail.isPrompt);

      const promptTotal = promptEntries.reduce(
        (sum, detail) => sum + (detail.value.cost || 0),
        0
      );
      const completionTotal = completionEntries.reduce(
        (sum, detail) => sum + (detail.value.cost || 0),
        0
      );

      const promptDetails: Record<string, number> = {};
      promptEntries.forEach((detail) => {
        if (detail.value.cost != null) {
          promptDetails[detail.tokenType] = detail.value.cost;
        }
      });

      const completionDetails: Record<string, number> = {};
      completionEntries.forEach((detail) => {
        if (detail.value.cost != null) {
          completionDetails[detail.tokenType] = detail.value.cost;
        }
      });

      return {
        total: promptTotal + completionTotal,
        prompt: promptTotal > 0 ? promptTotal : null,
        completion: completionTotal > 0 ? completionTotal : null,
        promptDetails:
          Object.keys(promptDetails).length > 0 ? promptDetails : null,
        completionDetails:
          Object.keys(completionDetails).length > 0 ? completionDetails : null,
      };
    }

    return {
      total: null,
      prompt: null,
      completion: null,
      promptDetails: null,
      completionDetails: null,
    };
  }, [data.node]);

  return <TokenCostsDetails {...costData} />;
}
