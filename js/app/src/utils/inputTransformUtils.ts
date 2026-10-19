/**
 * Wraps a controlled input's `onChange` so that every new value is passed
 * through `transform` (e.g. converting spaces to dashes) while keeping the
 * caret where the user expects it, including after a paste.
 *
 * The caret is read from the focused input rather than a ref so this also works
 * for composite components (e.g. ComboBox) that don't expose their input. It is
 * only repositioned when `transform` actually changed the value, so programmatic
 * updates such as selecting a ComboBox item are left alone.
 *
 * @example
 * <TextField onChange={withInputTransform(transformIdentifierInput, field.onChange)} />
 */
export function withInputTransform(
  transform: (value: string) => string,
  onChange: (value: string) => void
): (value: string) => void {
  return (value: string) => {
    const transformed = transform(value);
    if (transformed === value) {
      onChange(value);
      return;
    }
    const input =
      document.activeElement instanceof HTMLInputElement
        ? document.activeElement
        : null;
    const selectionStart = input?.selectionStart ?? value.length;
    // Transform the text before the caret to find where the caret lands
    const newCursorPosition = transform(value.slice(0, selectionStart)).length;

    onChange(transformed);

    // Restore cursor position after React updates the DOM
    requestAnimationFrame(() => {
      input?.setSelectionRange(newCursorPosition, newCursorPosition);
    });
  };
}
