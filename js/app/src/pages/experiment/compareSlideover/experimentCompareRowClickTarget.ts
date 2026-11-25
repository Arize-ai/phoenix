const INTERACTIVE_ELEMENT_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(", ");

/**
 * Whether a click landed on a control inside a table row, which then owns
 * the click instead of the row.
 */
export function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(INTERACTIVE_ELEMENT_SELECTOR) != null
  );
}
