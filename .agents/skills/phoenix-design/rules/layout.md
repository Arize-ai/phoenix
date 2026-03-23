# Layout & Interaction

## Layout stability

Loading states MUST use skeleton loaders so the page does not shift between loading and loaded states.

## Scroll behavior

Pages SHOULD have only one scrollable region. Scroll traps where the user's scroll gets captured by a nested container MUST be avoided.

## Interaction patterns

Each action MUST have one method of invocation. Confirm/cancel SHOULD be placed at the bottom of a dialog — controls MUST NOT be duplicated across header, footer, and shortcuts.
