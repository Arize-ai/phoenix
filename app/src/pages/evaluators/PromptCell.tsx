import { PromptNameWithBadge } from "@phoenix/components/prompt";

/**
 * Table cell component for displaying a prompt name with version badge.
 * Renders nothing if no prompt is provided.
 */
export const PromptCell = ({
  prompt,
  promptVersionTag,
  promptVersionId,
}: {
  prompt?: { id: string; name: string };
  promptVersionTag?: string;
  promptVersionId?: string;
}) => {
  if (!prompt) {
    return null;
  }
  if (promptVersionTag) {
    return <PromptNameWithBadge name={prompt.name} tag={promptVersionTag} />;
  }
  if (promptVersionId) {
    return <PromptNameWithBadge name={prompt.name} versionId={promptVersionId} />;
  }
  return null;
};
