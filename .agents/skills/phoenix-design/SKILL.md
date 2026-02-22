---
name: phoenix-design
description: CSS and design system conventions for the Phoenix frontend. Use when writing, modifying, or auditing Emotion CSS-in-JS styles, className assignments, BEM class names, theme classes, or cross-component CSS selectors in app/src/. Covers naming conventions, CSS variable usage, React Aria integration, and the complete component class name reference.
license: Apache-2.0
metadata:
  author: oss@arize.com
  version: "1.0.0"
  internal: true
---

# Phoenix Design System

Reference for CSS conventions, class naming, and Emotion CSS-in-JS patterns in the Phoenix frontend (`app/src/`).

## Quick Reference

| Task | See |
|---|---|
| Name a new CSS class | [BEM Naming Convention](#bem-naming-convention) |
| Use a CSS variable | [CSS Variables](#css-variables) |
| Style across component boundaries | [Cross-Component Selectors](#cross-component-selectors) |
| Apply theme-aware styles | [Theme Classes](#theme-classes) |
| Work with React Aria classes | [React Aria Integration](#react-aria-integration) |
| Audit for legacy class names | [Auditing & Verification](#auditing--verification) |
| Look up a component's class name | [Component Class Reference](#component-class-reference) |

---

## Key Facts

- **All styling is Emotion CSS-in-JS** — there are no traditional `.css` or `.scss` files in `app/src/`
- **No prefix on class names** — the legacy `ac-` (Arize Components) and `px-` prefixes have been removed; new classes must be unprefixed
- **BEM naming** is the standard: `block`, `block__element`, `block--modifier`
- CSS variables all use `--global-*` prefix (defined in `GlobalStyles.tsx`)
- Theme classes are applied to `document.body` via `ThemeContext.tsx`

---

## BEM Naming Convention

### Pattern

```
block                   → disclosure, tabs, slider
block__element          → slider__label, dialog__title, search-field__icon
block--modifier         → theme--dark, dropdown--picker
```

### Rules

- **Block**: A standalone component — `disclosure`, `search-field`, `toggle-button`
- **Element**: A part that cannot exist independently — uses `__` separator — `slider__label`, `field__icon`
- **Modifier**: A variant or state — uses `--` separator — `theme--dark`, `dropdown--picker`
- Compound names within a segment use hyphens: `search-field`, `toggle-button`, `dialog__close-button`
- **No prefix** — never add `ac-`, `px-`, or any other prefix to new classes

### Examples

```tsx
// Good
className="search-field"
className="search-field__clear"
className="disclosure__panel"
className="theme--dark"

// Bad — do not add prefixes
className="ac-search-field"
className="px-search-field__clear"
```

---

## CSS Variables

All design tokens are CSS custom properties defined in `app/src/GlobalStyles.tsx` and scoped to `:root, .theme`.

### Variable Prefix

All variables use `--global-*`:

```css
var(--global-dimension-size-200)
var(--global-font-size-m)
var(--global-text-color-900)
var(--global-color-primary)
var(--global-border-color-light)
var(--global-rounding-small)
var(--global-button-height-m)
var(--global-background-color-dark)
```

### Common Pitfall

CSS custom properties require the `--` prefix inside `var()`. This is **invalid**:

```css
/* WRONG — missing -- prefix */
padding-left: var(ac-global-dimensions-size-200);

/* CORRECT */
padding-left: var(--global-dimension-size-200);
```

---

## Theme Classes

### How They Work

Theme classes are applied to `document.body` in `app/src/contexts/ThemeContext.tsx`:

```tsx
document.body.classList.add("theme");
document.body.classList.add(`theme--${theme}`); // "theme--dark" or "theme--light"
```

### Selectors in GlobalStyles.tsx

```css
/* Base theme variables */
:root, .theme { ... }

/* Dark theme overrides */
:root, .theme--dark { ... }

/* Light theme overrides */
:root, .theme--light { ... }
```

### Overlay Container

The overlay portal also needs the theme class — applied in `GlobalStyles.tsx`:

```css
#root > div[data-overlay-container="true"] > .theme { ... }
```

---

## Cross-Component Selectors

Pages and feature components often need to style child component internals via CSS selectors. Use the unprefixed BEM class names as targets.

### Pattern

```tsx
// In a page or container component, target a child component's class
const pageCSS = css`
  .tabs {
    flex: 1 1 auto;
  }
  .tabs__pane-container {
    overflow: hidden;
  }
  .dropdown__button {
    width: 100%;
  }
  .disclosure__panel {
    height: 100%;
  }
`;
```

### Common Targets

| Target class | When to use |
|---|---|
| `.tabs` | Make tabs fill available space |
| `.tabs__pane-container` | Control overflow on tab panels |
| `.tabs__extra` | Style the extra content area of tabs |
| `.dropdown__button` | Force full-width dropdowns in forms |
| `.dropdown--picker` | Style picker-variant dropdowns |
| `.field` | Make a field fill full width |
| `.field__label` | Override label spacing |
| `.disclosure__panel` | Control disclosure panel layout |
| `.disclosure__trigger` | Style disclosure headers (hover states, etc.) |
| `.disclosure-group` | Control the group container |
| `.icon-wrap` | Adjust icon sizing within a parent |
| `.text` | Truncation or overflow on text nodes |
| `.view` | Width or layout overrides on View wrappers |
| `.slider__controls > .slider__track` | Style the filled portion of a slider |
| `.search-field` | Quiet search field variants in menus |

---

## React Aria Integration

Components built with `react-aria-components` carry both Phoenix BEM classes and `react-aria-*` classes. Phoenix BEM classes are assigned via `className=` and are the correct target for styling. React Aria's own classes (`react-aria-Button`, etc.) should not be used as styling targets in application code.

### How Component Classes Are Assigned

```tsx
// Component assigns its own BEM class alongside the react-aria class
<AriaTabs
  className={classNames("react-aria-Tabs", "tabs", className)}
  ...
/>

// Use the BEM class as the selector, not the react-aria class
.tabs { flex: 1 1 auto; }          // correct
.react-aria-Tabs { flex: 1 1 auto; } // avoid
```

### Data Attributes for State

React Aria exposes component state as `data-*` attributes — use these for state-based styling rather than class modifiers:

```css
&[data-hovered] { background-color: var(--hover-background); }
&[data-disabled] { opacity: var(--global-opacity-disabled); }
&[data-expanded="true"] { border-bottom: 1px solid ...; }
&[data-variant="quiet"] { ... }
&[data-invalid] { ... }
&[data-focus-visible] { outline: ...; }
```

---

## Component Class Reference

Complete mapping of Phoenix component class names.

### Theme / Global

| Class | Applied by |
|---|---|
| `theme` | `ThemeContext.tsx` on `document.body` |
| `theme--dark` | `ThemeContext.tsx` on `document.body` |
| `theme--light` | `ThemeContext.tsx` on `document.body` |

### Alert
| Class | Component |
|---|---|
| `alert__icon-title-wrap` | `Alert.tsx` |

### Button / Toggle
| Class | Component |
|---|---|
| `button` | CSS selector target (no className assignment in Button.tsx) |
| `toggle-button` | `ToggleButton.tsx` |
| `toggle-button-group` | `ToggleButtonGroup.tsx` |

### ComboBox
| Class | Component |
|---|---|
| `combobox__container` | `ComboBox.tsx` |
| `menu-item__selected-checkmark` | `ComboBox.tsx` (on icon-wrap inside menu item) |

### Counter / Badge
| Class | Component |
|---|---|
| `counter` | `Counter.tsx` |

### Dialog / Popover
| Class | Component |
|---|---|
| `dialog__header` | `Dialog.tsx` |
| `dialog__title` | `Dialog.tsx` |
| `dialog__title-extra` | `Dialog.tsx` |
| `dialog__close-button` | `Dialog.tsx` |
| `popover` | `Popover.tsx` |

### Disclosure / Accordion
| Class | Component |
|---|---|
| `disclosure-group` | `Disclosure.tsx` |
| `disclosure` | `Disclosure.tsx` |
| `disclosure__panel` | `Disclosure.tsx` |
| `disclosure__trigger` | `Disclosure.tsx` |

### Dropdown / Select
| Class | Component |
|---|---|
| `dropdown` | CSS selector target |
| `dropdown--picker` | CSS selector target |
| `dropdown__button` | CSS selector target |
| `select` | `Select.tsx` |
| `radio` | `Radio.tsx` |
| `radio-group` | `RadioGroup.tsx` |

### Field / Input
| Class | Component |
|---|---|
| `field` | CSS selector target |
| `field__label` | CSS selector target |
| `field__icon` | `FieldDangerIcon.tsx`, `FieldSuccessIcon.tsx` |
| `text-field` | `TextField.tsx`, `NumberField.tsx` |
| `credential-field` | `CredentialField.tsx` |
| `credential-input__toggle` | `CredentialInput.tsx` |
| `search-field` | `SearchField.tsx` |
| `search-field__clear` | `SearchField.tsx` |
| `search-field__icon` | `SearchField.tsx` |

### Layout / Structure
| Class | Component |
|---|---|
| `group` | `Group.tsx` |
| `view` | `View.tsx` |
| `separator` | `Separator.tsx` |
| `icon-wrap` | `Icon.tsx` |
| `visually-hidden` | `VisuallyHidden.tsx` |

### Slider
| Class | Component |
|---|---|
| `slider` | `Slider.tsx` |
| `slider__label` | `Slider.tsx` |
| `slider__output` | `Slider.tsx` |
| `slider__track` | `Slider.tsx` |
| `slider__thumb` | `Slider.tsx` |
| `slider__controls` | `Slider.tsx` |
| `slider__number-field` | `Slider.tsx` |

### Tabs
| Class | Component |
|---|---|
| `tabs` | `Tabs.tsx` |
| `tabs__extra` | `Tabs.tsx` |
| `tabs__pane-container` | `Tabs.tsx` |

### Text / Typography
| Class | Component |
|---|---|
| `text` | `Text.tsx` |
| `heading` | `Heading.tsx` |
| `keyboard` | `Keyboard.tsx` |

### Token
| Class | Component |
|---|---|
| `token__text` | `Token.tsx` |

### Loading
| Class | Component |
|---|---|
| `skeleton` | `Skeleton.tsx` |

---

## Auditing & Verification

### Check for legacy prefixed classes

```bash
# Should return zero results
grep -rn "ac-" app/src/ --include="*.tsx" --include="*.ts" | grep -v "__generated__" | grep -v "//.*ac-"
grep -rn "px-combobox\|px-menu\|\"px-\|\.px-" app/src/ --include="*.tsx" --include="*.ts" | grep -v "__generated__"
```

### Full verification suite

```bash
pnpm --dir app run typecheck   # 0 errors expected
pnpm --dir app run lint:fix    # 0 warnings/errors expected
pnpm --dir app test            # all tests pass
```

### Mass rename strategy

When renaming a class used in many files, use `replace_all: true` with the Edit tool. Be careful with substring matches — rename more specific strings first (e.g., rename `.ac-tabs__pane-container` before `.ac-tabs` to avoid double-substitution).

```tsx
// Step 1 — rename the more specific string first
// .ac-tabs__pane-container → .tabs__pane-container

// Step 2 — then rename the base
// .ac-tabs → .tabs
```

### Two locations to update for every class

Every class name lives in **two places** that must both be updated:
1. The **CSS definition** — the Emotion template literal where it appears as a selector (e.g., `.slider__label { ... }`)
2. The **className assignment** — the TSX `className="slider__label"` prop

Additionally, check for **cross-component selectors** in pages and feature components that target the class from outside its defining component.
