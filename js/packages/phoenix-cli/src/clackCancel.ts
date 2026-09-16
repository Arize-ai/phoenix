import { isCancel } from "@clack/prompts";

/**
 * Narrowing wrapper around clack's `isCancel`.
 *
 * Clack's own guard is typed `value is typeof CANCEL_SYMBOL`, where
 * `CANCEL_SYMBOL` is a `unique symbol`. TypeScript cannot subtract a
 * `unique symbol` from the broad `symbol` that every prompt returns, so
 * `isCancel` narrows the true branch but leaves the false branch as
 * `Value | symbol` — the non-cancelled value stays unusable. Re-declaring the
 * guard as `value is symbol` makes the false branch narrow to `Value`.
 *
 * Drop this in favour of the upstream guard if clack ever widens its signature.
 */
export function isCancelled(value: unknown): value is symbol {
  return isCancel(value);
}
