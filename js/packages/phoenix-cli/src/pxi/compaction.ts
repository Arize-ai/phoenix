import type { PxiMessage } from "./types";

/**
 * Compaction checkpoints in the PXI transcript.
 *
 * Compacting a session persists a checkpoint message that summarizes every
 * prior turn; the server then loads model history from the latest checkpoint
 * onward. On the wire a checkpoint is an ordinary user-role message flagged by
 * `metadata.isCompactionMessage`, so the transcript renders it distinctly
 * rather than as something the user typed.
 */

/** Whether a transcript message is a compaction checkpoint. */
export function isCompactionMessage({
  message,
}: {
  message: PxiMessage;
}): boolean {
  // Read defensively: PxiMessage types metadata for assistant messages, so a
  // user-role checkpoint's metadata arrives untyped.
  const metadata = message.metadata as
    | { isCompactionMessage?: unknown }
    | undefined;
  return message.role === "user" && metadata?.isCompactionMessage === true;
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
