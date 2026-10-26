import { graphql, useFragment } from "react-relay";

import { PromptLayoutShell } from "@phoenix/pages/prompt/PromptLayoutShell";

import type { DecisionLayout__main$key } from "./__generated__/DecisionLayout__main.graphql";
import { CloneDecisionDialog } from "./CloneDecisionDialog";

/**
 * The header and tabs of a decision's detail pages
 */
export function DecisionLayout({
  decision,
}: {
  decision: DecisionLayout__main$key;
}) {
  const data = useFragment<DecisionLayout__main$key>(
    graphql`
      fragment DecisionLayout__main on Decision {
        id
        name
        description
        metadata
        versionCount
        sourceDecision {
          id
          name
        }
      }
    `,
    decision
  );
  return (
    <PromptLayoutShell
      id={data.id}
      name={data.name}
      kindLabel="Decision"
      source={data.sourceDecision}
      cloneDialog={
        <CloneDecisionDialog
          decisionId={data.id}
          decisionName={data.name}
          decisionDescription={data.description ?? undefined}
          decisionMetadata={data.metadata ?? undefined}
        />
      }
      playgroundTo={`/playground?decisionId=${encodeURIComponent(data.id)}`}
      playgroundAriaLabel="Open this Decision in Playground"
      versionCount={data.versionCount}
    />
  );
}
