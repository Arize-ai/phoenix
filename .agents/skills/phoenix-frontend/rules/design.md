# Design & Visual Quality

## Layout stability

Loading states MUST use skeleton loaders so the page doesn't shift between loading and loaded states.

## Scroll behavior

Pages SHOULD have only one scrollable region. Scroll traps where the user's scroll gets captured by a nested container MUST be avoided.

## Error display

Errors MUST be scoped to the appropriate level. Toast MUST NOT be used for errors.

| Scope                   | Display             |
| ----------------------- | ------------------- |
| Element (field invalid) | error slot          |
| Section (group invalid) | Section-level alert |

Inline errors using error slots and existing field patterns SHOULD be preferred. Alert banners SHOULD be used for broader errors.

### Input validation

- Restrictions MUST be communicated via description slots before submission

## Interaction patterns

Each action MUST have one method of invocation. Confirm/cancel SHOULD be placed at the bottom of a dialog — controls MUST NOT be duplicated across header, footer, and shortcuts.
