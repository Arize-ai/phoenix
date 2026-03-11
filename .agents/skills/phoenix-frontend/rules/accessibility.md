# Accessibility

## Semantic elements

- Interactive actions MUST use buttons, not clickable divs
- Lists MUST use `<ul>`/`<ol>`
- `elementType` props SHOULD be used to avoid unnecessary div nesting

## Interaction patterns

- Overlays MUST open on click/keyboard activation — hover triggers MUST NOT be used. Hover is unreliable on touch and adds steps.
- Focus management SHOULD be left to the component library on dialog open/close — manual `focus()` calls SHOULD NOT be used unless necessary.

## WCAG 2.1 AA baseline

[WCAG 2.1 AA](https://www.w3.org/WAI/standards-guidelines/wcag/) MUST be followed: 4.5:1 contrast for text, keyboard operability, visible focus indicators, labeled form inputs.
