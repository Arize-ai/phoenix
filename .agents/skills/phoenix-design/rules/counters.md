# Counters

When displaying a count alongside a label (e.g. in a `Tab`, section heading, or filter button), you MUST use the `Counter` component from `@phoenix/components/core/counter`.

You MUST NOT inline the count using brackets or parentheses (e.g. `Versions (3)` or `Versions [3]`). The `Counter` provides consistent typography, spacing, and a pill background that distinguishes the count from the label.

## Correct

```tsx
import { Counter } from "@phoenix/components/core/counter";

<Tab id="versions">
  Versions <Counter>{versionsCount}</Counter>
</Tab>
```

## Incorrect

```tsx
<Tab id="versions">{`Versions (${versionsCount})`}</Tab>
```

## Variants

- `default` — standard count badge
- `quiet` — borderless, transparent background; use inside selected/active tabs where the count should recede
- `danger` — use only when the count itself signals an error condition
