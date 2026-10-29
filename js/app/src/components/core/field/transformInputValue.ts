/**
 * Runs a value the user just typed into a controlled input through `transform`
 * (e.g. converting spaces to dashes) without moving the caret.
 *
 * React moves the caret to the end when a controlled input's value changes
 * under it, so the focused input is rewritten in place first, with the caret
 * kept after the text it followed. React then sees the DOM already holds the
 * new value and leaves it alone. The input is only rewritten while it still
 * holds `value`, so programmatic changes such as a ComboBox filling in a
 * selected item are left to React.
 *
 * @example
 * <TextField
 *   onChange={(value) =>
 *     field.onChange(transformInputValue(value, transformIdentifierInput))
 *   }
 * />
 */
export function transformInputValue(
  value: string,
  transform: (value: string) => string
): string {
  const transformed = transform(value);
  const input = document.activeElement;
  if (
    transformed !== value &&
    input instanceof HTMLInputElement &&
    input.value === value
  ) {
    const caret = transform(
      value.slice(0, input.selectionStart ?? value.length)
    ).length;
    input.value = transformed;
    input.setSelectionRange(caret, caret);
  }
  return transformed;
}
