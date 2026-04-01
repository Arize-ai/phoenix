import { confirm as clackConfirm, isCancel } from "@clack/prompts";

export type ConfirmResult =
  | { outcome: "confirmed" }
  | { outcome: "declined" }
  | { outcome: "cancelled" };

export interface ConfirmDestructiveOptions {
  /**
   * Question describing the irreversible action.
   * e.g. "Delete trace abc123? This action cannot be undone."
   */
  message: string;
  /**
   * When true, skip the prompt and treat as confirmed (--no-input).
   */
  noInput?: boolean;
  /**
   * Injected confirm implementation for testing.
   * Defaults to @clack/prompts `confirm`.
   */
  _confirm?: (opts: { message: string }) => Promise<boolean | symbol>;
}

/**
 * Present a yes/no confirmation for a destructive action.
 *
 * Returns "confirmed" when noInput is true or the user answers yes.
 * Returns "declined" when the user answers no.
 * Returns "cancelled" when the user presses Ctrl-C.
 */
export async function confirmDestructive({
  message,
  noInput = false,
  _confirm = clackConfirm,
}: ConfirmDestructiveOptions): Promise<ConfirmResult> {
  if (noInput) {
    return { outcome: "confirmed" };
  }
  const result = await _confirm({ message });
  if (isCancel(result)) {
    return { outcome: "cancelled" };
  }
  return { outcome: result ? "confirmed" : "declined" };
}
