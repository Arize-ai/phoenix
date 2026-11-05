# Counters

When displaying a count alongside a label (e.g. in a `Tab`, section heading, navigation item, or filter button), you MUST use the `Counter` component from `@phoenix/components/core/counter`.

You MUST NOT inline the count using brackets or parentheses (e.g. `Versions (3)` or `Versions [3]`). The `Counter` provides consistent typography and spacing that set the count apart from the label; outside tabs, its default round background sets it apart further.

`Counter` takes a number through its `count` prop, not children. It only renders counts: a position such as `#2` is ordinary `Text`, not a `Counter`.

## Correct

```tsx
import { Counter } from "@phoenix/components/core/counter";

<Tab id="versions">
  Versions <Counter variant="quiet" count={versionsCount} />
</Tab>
```

## Incorrect

```tsx
<Tab id="versions">{`Versions (${versionsCount})`}</Tab>
```

## Props

- `count` — the number, or `null` while it is not known yet, which renders a `--` placeholder
- `max` — the largest count shown in full; a larger count renders as `max+` (e.g. `99+`)
- `notation` — `standard` (default, grouped: `1,234`) or `compact` (three significant digits: `1.23K`)
- `showZero` — default `true`; keep it for a set whose emptiness is worth seeing, such as a tab; set `false` for a notification count that should disappear at zero

## Counters in tabs

A `Counter` inside a `Tab` MUST use the `quiet` variant. The tab label is what a reader scans for; a count on the default round background beside every label competes with it and with the selected-tab indicator. The one exception is `danger`: when the count itself signals an error condition (e.g. a span's events include an exception), it MAY use `danger` instead.

```tsx
// Correct
<Tab id="examples">
  Examples <Counter variant="quiet" count={exampleCount} />
</Tab>

// Incorrect — the default background competes with the tab label
<Tab id="examples">
  Examples <Counter count={exampleCount} />
</Tab>
```

## Variants

- `neutral` — the default count badge; use outside tabs (section headings, card titles, filter buttons)
- `quiet` — borderless, transparent background; REQUIRED inside tabs, and for counts that should recede elsewhere
- `danger` — use only when the count itself signals an error condition

## Accessible name

The parent's accessible name picks the count up from `Counter`'s text, so a tab reads as "Versions (3)" without composing an `aria-label`. The visible number is hidden from assistive technology and a visually hidden copy always gives the full count, so `99+` and `1.23K` still announce the exact value. A `null` count adds nothing to the name. This only works when the name comes from content: a parent with its own `aria-label` replaces that computed name, so its label must include the count (e.g. `aria-label="Exceptions, 3"`).
