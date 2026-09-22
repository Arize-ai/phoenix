# Layout & Interaction

## Layout stability

Loading states MUST use skeleton loaders so the page does not shift between loading and loaded states.

## Scroll behavior

Pages SHOULD have only one scrollable region. Scroll traps where the user's scroll gets captured by a nested container MUST be avoided.

## Interaction patterns

Each action MUST have one method of invocation. Confirm/cancel SHOULD be placed at the bottom of a dialog — controls MUST NOT be duplicated across header, footer, and shortcuts. Exception: dialog close buttons MAY appear in both the top-right corner and the footer.

Row actions (e.g. delete, edit) for simple list or menu items MUST be always visible. Hiding actions behind hover states reduces discoverability and is inaccessible to touch users.

## Copy affordances

A `Card` whose body holds content worth copying MUST offer a copy button in its header's `extra` slot, and that button MUST be the last control in the slot so it lands in the same place on every card. Copy MUST NOT be placed inside the card body — a reader should never have to hunt for it, or hover to find it.

A card copies what it is currently showing. Where a card holds a list of items that are themselves cards (messages, documents, tool schemas), the outer card copies the whole list and each item card copies its own content.
