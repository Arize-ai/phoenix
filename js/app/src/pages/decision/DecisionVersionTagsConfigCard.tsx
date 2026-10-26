import { useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import type { VersionTagsConfigRow } from "@phoenix/pages/prompt/VersionTagsConfigTable";
import { VersionTagsConfigTable } from "@phoenix/pages/prompt/VersionTagsConfigTable";

import type { DecisionVersionTagsConfigCard_data$key } from "./__generated__/DecisionVersionTagsConfigCard_data.graphql";
import { DeleteDecisionVersionTagButton } from "./DeleteDecisionVersionTagButton";

export function DecisionVersionTagsConfigCard({
  decision,
}: {
  decision: DecisionVersionTagsConfigCard_data$key;
}) {
  const data = useFragment<DecisionVersionTagsConfigCard_data$key>(
    graphql`
      fragment DecisionVersionTagsConfigCard_data on Decision {
        id
        versionTags {
          id
          name
          description
          decisionVersionId
        }
      }
    `,
    decision
  );
  const tags = useMemo(
    () =>
      data.versionTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        versionId: tag.decisionVersionId,
      })),
    [data.versionTags]
  );
  const renderDeleteButton = useCallback(
    (tag: VersionTagsConfigRow) => (
      <DeleteDecisionVersionTagButton
        decisionVersionTagId={tag.id}
        tagName={tag.name}
      />
    ),
    []
  );
  return (
    <VersionTagsConfigTable
      ownerId={data.id}
      tags={tags}
      renderDeleteButton={renderDeleteButton}
    />
  );
}
