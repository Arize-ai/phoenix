import { graphql, useLazyLoadQuery } from "react-relay";

import { Alert, Card } from "@phoenix/components";
import type { TextDiffStyle } from "@phoenix/components/diff";

import type { PromptVersionConfigDiffView__version$key } from "./__generated__/PromptVersionConfigDiffView__version.graphql";
import type { PromptVersionDiffCardsQuery } from "./__generated__/PromptVersionDiffCardsQuery.graphql";
import type { PromptVersionDiffView__template$key } from "./__generated__/PromptVersionDiffView__template.graphql";
import { PromptVersionConfigDiffView } from "./PromptVersionConfigDiffView";
import { PromptVersionDiffView } from "./PromptVersionDiffView";

export type PromptVersionDiffCardsProps = {
  /**
   * The version to diff against (the "old" side)
   */
  baselineVersionId: string;
  /**
   * The version being viewed (the "new" side)
   */
  current: PromptVersionDiffView__template$key &
    PromptVersionConfigDiffView__version$key;
  diffStyle: TextDiffStyle;
};

/**
 * Fetches the baseline prompt version and renders git-like diffs of the
 * prompt template and the model configuration against the current version.
 */
export function PromptVersionDiffCards({
  baselineVersionId,
  current,
  diffStyle,
}: PromptVersionDiffCardsProps) {
  const data = useLazyLoadQuery<PromptVersionDiffCardsQuery>(
    graphql`
      query PromptVersionDiffCardsQuery($id: ID!) {
        baseline: node(id: $id) {
          __typename
          ... on PromptVersion {
            ...PromptVersionDiffView__template
            ...PromptVersionConfigDiffView__version
          }
        }
      }
    `,
    { id: baselineVersionId }
  );
  const baseline =
    data.baseline?.__typename === "PromptVersion" ? data.baseline : null;
  if (baseline == null) {
    return (
      <Alert variant="danger">
        The version to compare against could not be found.
      </Alert>
    );
  }
  return (
    <>
      <Card
        title="Prompt"
        collapsible
        data-testid="prompt-chat-messages-diff-card"
      >
        <PromptVersionDiffView
          current={current}
          baseline={baseline}
          diffStyle={diffStyle}
        />
      </Card>
      <Card
        title="Model Configuration"
        collapsible
        data-testid="prompt-model-configuration-diff-card"
      >
        <PromptVersionConfigDiffView
          current={current}
          baseline={baseline}
          diffStyle={diffStyle}
        />
      </Card>
    </>
  );
}
