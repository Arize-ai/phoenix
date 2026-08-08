# Accessibility

## Semantic elements

- Interactive actions MUST use buttons, not clickable divs
- Lists MUST use `<ul>`/`<ol>` + `<li>`, never a stack of `<div>`s — even for non-bulleted layouts (key/value rows, menus, tag lists). Reset chrome with `list-style: none; margin: 0; padding: 0;` and apply your flex/grid layout on top.

## WCAG 2.1 AA baseline

[WCAG 2.1 AA](https://www.w3.org/WAI/standards-guidelines/wcag/) MUST be followed: 4.5:1 contrast for text, keyboard operability, visible focus indicators, labeled form inputs.
