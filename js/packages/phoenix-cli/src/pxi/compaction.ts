import type { PxiMessage } from "./types";

/**
 * Compaction checkpoints in the PXI transcript.
 *
 * Compacting a session persists a checkpoint message that summarizes every
 * prior turn; the server then loads model history from the latest checkpoint
 * onward. On the wire a checkpoint is an ordinary user-role message flagged by
 * `metadata.phoenix.isCompactionMessage`, so the transcript renders it distinctly
 * rather than as something the user typed.
 */

/** Whether a transcript message is a compaction checkpoint. */
export function isCompactionMessage({
  message,
}: {
  message: PxiMessage;
}): boolean {
  const phoenixMetadata = message.metadata?.phoenix;
  return (
    message.role === "user" &&
    phoenixMetadata?.type === "user" &&
    phoenixMetadata.isCompactionMessage === true
  );
}

/** The checkpoint's summary text — the concatenated text parts. */
export function getCompactionSummary({
  message,
}: {
  message: PxiMessage;
}): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
