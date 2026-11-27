/**
 * Elements that take arrow keys for themselves: text entry, and composite
 * widgets that move a selection or a value with them.
 */
const ARROW_KEY_CONSUMER_SELECTOR = [
  "input",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
  '[role="radiogroup"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="tree"]',
  '[role="treegrid"]',
  '[role="grid"]',
  '[role="tablist"]',
  '[role="slider"]',
  '[role="separator"]',
  '[role="toolbar"]',
].join(", ");

/**
 * Whether a key event's target already uses arrow keys, so the slideover's
 * arrow shortcuts must leave the event alone.
 */
export function isArrowKeyConsumer(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(ARROW_KEY_CONSUMER_SELECTOR) != null
  );
}
