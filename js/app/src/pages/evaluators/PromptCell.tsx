import { VersionedNameLink } from "./VersionedNameLink";

export const PromptCell = ({
  prompt,
  promptVersionTag,
  wrapWidth,
}: {
  prompt?: { id: string; name: string };
  promptVersionTag?: string;
  /**
   * When set, constrains the component to a max-width (in pixels) and allows
   * the content to wrap onto two lines if needed. When undefined, the component
   * displays inline without wrapping.
   */
  wrapWidth?: number;
}) => {
  if (!prompt) {
    return null;
  }
  return (
    <PromptLink
      promptId={prompt.id}
      promptName={prompt.name}
      promptVersionTag={promptVersionTag}
      wrapWidth={wrapWidth}
    />
  );
};

export const PromptLink = ({
  promptId,
  promptName,
  promptVersionTag,
  wrapWidth,
  nameMaxWidth,
}: {
  promptId: string;
  promptName: string;
  promptVersionTag?: string;
  /** See VersionedNameLink. */
  wrapWidth?: number;
  /** See VersionedNameLink. */
  nameMaxWidth?: string;
}) => {
  // if tag exists, that means the evaluator is pinned to a specific version of the prompt
  // otherwise, we assume the latest version is pinned
  const to = promptVersionTag
    ? `/redirects/prompts/${promptId}/tags/${encodeURIComponent(promptVersionTag)}`
    : `/prompts/${promptId}`;
  return (
    <VersionedNameLink
      to={to}
      name={promptName}
      versionTag={promptVersionTag}
      wrapWidth={wrapWidth}
      nameMaxWidth={nameMaxWidth}
    />
  );
};
