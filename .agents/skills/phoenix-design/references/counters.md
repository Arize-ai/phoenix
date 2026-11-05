# Counters

When displaying a count alongside a label (e.g. in a `Tab`, section heading, or filter button), you MUST use the `Counter` component from `@phoenix/components/core/counter`.

You MUST NOT inline the count using brackets or parentheses (e.g. `Versions (3)` or `Versions [3]`). The `Counter` provides consistent typography and spacing that set the count apart from the label; outside tabs, its default pill background sets it apart further.

## Correct

```tsx
import { Counter } from "@phoenix/components/core/counter";

<Tab id="versions">
  Versions <Counter variant="quiet">{versionsCount}</Counter>
</Tab>
```

## Incorrect

```tsx
<Tab id="versions">{`Versions (${versionsCount})`}</Tab>
```

## Counters in tabs

A `Counter` inside a `Tab` MUST use the `quiet` variant. The tab label is what a reader scans for; a pill-backed count beside every label competes with it and with the selected-tab indicator. The one exception is `danger`: when the count itself signals an error condition (e.g. a span's events include an exception), it MAY use `danger` instead.

```tsx
// Correct
<Tab id="examples">
  Examples <Counter variant="quiet">{exampleCount}</Counter>
</Tab>

// Incorrect — the default pill competes with the tab label
<Tab id="examples">
  Examples <Counter>{exampleCount}</Counter>
</Tab>
```

## Variants

- `default` — standard count badge; use outside tabs (section headings, card titles, filter buttons)
- `quiet` — borderless, transparent background; REQUIRED inside tabs, and for counts that should recede elsewhere
- `danger` — use only when the count itself signals an error condition
