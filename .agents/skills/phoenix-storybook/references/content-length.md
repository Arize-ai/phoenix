# Content length

Model variable content at multiple lengths. Prefer one labeled
`Content Length` story that renders all relevant cases together.

## Lists and repeated content

For menus and other list-like content, show:

1. zero items;
2. one item;
3. a normal number for a typical production context;
4. enough items to expose overflow behavior; and
5. an atypically large but valid number that shows how the component copes
   with high volume.

Use the smallest counts that clearly demonstrate overflow and high volume.
Never create a stress case large enough to risk crashing the browser or
degrading its performance.

Label only the cases whose count is not self-evident. Empty, one and five
items read at a glance and need no heading; label the overflow and
high-volume counts (`25 items`, `250 items`). Lay wide cases out sideways and
wrap them into rows by kind: `Menu`'s item count puts the empty state alone
on the first row, one and five items on the second, the labeled overflow
cases on the third, with `themeLayout: "column"`.

## Variable text

For form values, labels, titles, and similar text, show:

1. an empty string when the production prop type permits it;
2. a single character;
3. a representative regular string; and
4. a long string chosen to expose wrapping, clipping, or truncation.

Use production-plausible wording even in edge cases, and label each case so
the behavior reads without the source.

**Draw lengths from the real shapes of the value.** When production passes a
few known kinds of value, those are the length cases: an `ID Badge` shows a
16-hex span ID, a 32-hex trace ID and a long user-supplied external ID; a
`Counter` shows the count, `#n` position, `.3s`-abbreviated and `--`
placeholder forms. An empty case production renders (an empty ID in a loading
fallback) belongs in the grid too.

## Measure that the long case overflows

A container that happens to fit the long string proves nothing: a `Badge`
overflow story set "24 days left in trial" in a 120px box, which the label
fits at 110px, so neither mode ever wrapped or truncated and a broken
`overflowMode="truncate"` went unseen. Choose the container width from a
measurement, check with bounding boxes that the long case exceeds it in the
wrapping mode, and put the component inside a width-constrained wrapper
rather than making it the `OptionGrid` cell itself, since a grid item grows
to its content.

## Overflow versus constraints

Keep overflow and constraint cases in separate stories, each on the part that
owns it: text too long for an item is `Menu Item`'s `Content Length`; how tall
or wide the menu may grow is `Menu Container`'s `Size Constraints`. Name an
overflow case for the length it varies, never after one symptom such as
`Long Item Text`.

Label a constraint on the column side. When the component lets a caller set
it, the story's docblock says how — which prop, its default and the values to
pass. That is the exception to an option grid's usual lack of a docblock.
