import { useCallback } from "react";

import { CanModify } from "@phoenix/components/auth";
import type { VersionTagRow } from "@phoenix/components/versions/VersionTagsConfigCard";
import { VersionTagsConfigCard } from "@phoenix/components/versions/VersionTagsConfigCard";

import { DeleteDecisionVersionTagButton } from "./DeleteDecisionVersionTagButton";

export function DecisionVersionTagsConfigCard({
  decisionId,
  versionTags,
  onDeleted,
}: {
  decisionId: string;
  versionTags: ReadonlyArray<{
    id: string;
    name: string;
    description: string | null;
    decisionVersionId: string;
  }>;
  onDeleted: () => void;
}) {
  const getVersionPath = useCallback(
    (versionId: string) =>
      `/prompts/decisions/${decisionId}/versions/${versionId}`,
    [decisionId]
  );
  const renderDeleteButton = useCallback(
    (tag: VersionTagRow) => (
      // A new key per tag, or the dialog stays open on the row that replaces the deleted one
      <CanModify key={tag.id}>
        <DeleteDecisionVersionTagButton tagId={tag.id} onDeleted={onDeleted} />
      </CanModify>
    ),
    [onDeleted]
  );
  return (
    <VersionTagsConfigCard
      tags={versionTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        versionId: tag.decisionVersionId,
      }))}
      getVersionPath={getVersionPath}
      renderDeleteButton={renderDeleteButton}
    />
  );
}
