# Error Display

## Never use toasts for errors

Error toasts (`useNotifyError`) are an accessibility anti-pattern — they are ephemeral and may disappear before assistive technology users can read them. **Do not use toasts to display errors.**

Use inline `<Alert variant="danger">` banners instead. Store the error message in local component state with `useState<string | null>(null)`.

### Pattern

```tsx
const [error, setError] = useState<string | null>(null);

// In mutation onError:
onError: (error) => {
  setError(error.message);
},

// In JSX — render at the top of the dialog/form, after the header:
{error && <Alert variant="danger">{error}</Alert>}
```

### Dialog placement

In dialogs/modals, place the error Alert **after the DialogHeader and before the body content**. Use the `banner` prop for full-width styling:

```tsx
<DialogHeader>...</DialogHeader>
{error && (
  <View paddingX="size-200" paddingTop="size-100">
    <Alert variant="danger" banner>{error}</Alert>
  </View>
)}
<View padding="size-200">
  {/* dialog body */}
</View>
```

### Error state lifecycle

- **Clear on reopen**: Reset error state when a dialog reopens so stale errors don't persist.
- **Clear on resubmit**: Reset error state at the start of a new submission attempt.
- **Keep errors local**: Error state belongs in the component that owns the mutation — do not propagate errors up to parent components via callback props.

### When toasts ARE appropriate

Toasts are appropriate for **success** notifications (`useNotifySuccess`) since those are informational and non-critical if missed. Only errors require persistent, inline display.
