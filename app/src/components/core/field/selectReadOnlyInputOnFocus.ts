import type { FocusEvent } from "react";

type SelectableFieldInput = HTMLInputElement | HTMLTextAreaElement;

function isSelectableFieldInput(
  target: EventTarget | null
): target is SelectableFieldInput {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  );
}

export function selectReadOnlyInputOnFocus(event: FocusEvent<Element>) {
  const target = event.target;

  if (!isSelectableFieldInput(target)) {
    return;
  }

  const isReadOnly =
    event.currentTarget.hasAttribute("data-readonly") || target.readOnly;

  if (!isReadOnly) {
    return;
  }

  window.setTimeout(() => {
    try {
      target.select();
    } catch {
      // Some input types do not support selection.
    }
  }, 0);
}
