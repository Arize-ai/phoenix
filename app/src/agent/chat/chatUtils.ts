import type { ChatStatus } from "ai";

/** Whether the chat has a request in flight (submitted or streaming). */
export function isRequestActive(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}
