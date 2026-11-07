import { VersionedNameLink } from "./VersionedNameLink";

export type DecisionCellVersion = {
  id: string;
  decisionId: string;
  /** The decision; select `decision { name }` next to the version. */
  decision?: { name: string } | null;
};

/**
 * Decision evaluators' counterpart of PromptCell: the decision and the tag the
 * evaluator runs through, or `latest` without one. Renders exactly as
 * PromptCell does, so prompt and decision rows read alike.
 */
export const DecisionCell = ({
  decisionVersion,
  decisionVersionTag,
  wrapWidth,
  nameMaxWidth,
}: {
  /** The version the evaluator runs: its tag's, or the decision's newest. */
  decisionVersion?: DecisionCellVersion | null;
  /** The evaluator's tag name; omit when it runs the latest version. */
  decisionVersionTag?: string | null;
  /** See VersionedNameLink. */
  wrapWidth?: number;
  /** See VersionedNameLink. */
  nameMaxWidth?: string;
}) => {
  if (!decisionVersion) {
    return null;
  }
  const { decisionId, id, decision } = decisionVersion;
  // Pinned to a tag: open the version the tag points at. Otherwise the
  // evaluator follows the latest version, so open the decision itself.
  const to = decisionVersionTag
    ? `/prompts/decisions/${decisionId}/versions/${id}`
    : `/prompts/decisions/${decisionId}`;
  return (
    <VersionedNameLink
      to={to}
      name={decision?.name || "Decision"}
      versionTag={decisionVersionTag}
      wrapWidth={wrapWidth}
      nameMaxWidth={nameMaxWidth}
    />
  );
};
