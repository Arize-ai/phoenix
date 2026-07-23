import { css } from "@emotion/react";

import { Alert, Button, Flex, Text } from "@phoenix/components";

/** Which action the confirmation is gating. */
export type MessageRewindMode = "rewind" | "fork";

/** Whose message the action targets, which changes the explanatory copy. */
export type MessageRewindRole = "user" | "assistant";

type ConfirmationCopy = {
  title: string;
  description: string;
  confirmLabel: string;
};

/**
 * Resolves the title/description/confirm-label from the action mode and the
 * target message's role. User-targeted actions explain that the message is
 * restored to the input for editing; assistant-targeted actions explain that
 * the conversation reverts to that response.
 */
function getConfirmationCopy({
  mode,
  role,
}: {
  mode: MessageRewindMode;
  role: MessageRewindRole;
}): ConfirmationCopy {
  if (mode === "fork") {
    return {
      title: "Branch conversation",
      description:
        role === "user"
          ? "Create a new chat branch from this point. This message is removed from the new branch and placed back in the input so you can edit and re-send it. The current chat is left unchanged."
          : "Create a new chat branch that ends at this response. The current chat is left unchanged.",
      confirmLabel: "Branch conversation",
    };
  }
  return {
    title: "Rewind conversation",
    description:
      role === "user"
        ? "Remove this message and everything after it, and place it back in the input so you can edit and re-send it. This cannot be undone."
        : "Revert the chat to this response and discard everything after it, including any pending tool calls. This cannot be undone.",
    confirmLabel: "Rewind conversation",
  };
}

const confirmationCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-200);
`;

const confirmationHeaderCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

const confirmationActionsCSS = css`
  display: flex;
  justify-content: flex-end;
  gap: var(--global-dimension-size-100);
  flex-wrap: wrap;
`;

/**
 * Inline confirmation shown in place of the prompt input before rewinding or
 * branching a conversation at a chosen message.
 *
 * This is intentionally an inline panel rather than a React Aria modal. Opening
 * a modal flips the app's global open-modal observer, which re-parents the
 * agent chat panel between its docked and floating layouts; a modal owned by
 * the panel would be torn down the instant it opened, looping forever. An
 * inline confirmation keeps the interaction scoped to the panel and avoids that
 * feedback entirely, mirroring the consent gate and elicitation surfaces.
 */
export function MessageRewindConfirmation({
  mode,
  role,
  error,
  isPending = false,
  onConfirm,
  onCancel,
}: {
  mode: MessageRewindMode;
  role: MessageRewindRole;
  error?: string | null;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { title, description, confirmLabel } = getConfirmationCopy({
    mode,
    role,
  });

  return (
    <div css={confirmationCSS} role="alertdialog" aria-label={title}>
      <div css={confirmationHeaderCSS}>
        <Text elementType="h3" size="L" weight="heavy">
          {title}
        </Text>
        <Text color="text-700">{description}</Text>
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      <Flex direction="row" css={confirmationActionsCSS}>
        <Button
          variant="default"
          size="S"
          isDisabled={isPending}
          onPress={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant={mode === "rewind" ? "danger" : "primary"}
          size="S"
          isDisabled={isPending}
          onPress={onConfirm}
        >
          {isPending ? "Working…" : confirmLabel}
        </Button>
      </Flex>
    </div>
  );
}
