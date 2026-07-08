# Error Display

## Never use toasts for errors

Error toasts (`useNotifyError`) are an accessibility anti-pattern — they are ephemeral and may disappear before assistive technology users can read them. Toasts MUST NOT be used to display errors.

Use inline `<Alert variant="danger">` banners instead. Error messages SHOULD be stored in local component state with `useState<string | null>(null)`.

## Error scoping

Errors MUST be scoped to the appropriate level. Inline errors using error slots and existing field patterns SHOULD be preferred. Alert banners SHOULD be used for broader errors.

| Scope                   | Display             |
| ----------------------- | ------------------- |
| Element (field invalid) | error slot          |
| Section (group invalid) | Section-level alert |

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

In dialogs/modals, the error Alert MUST be placed **after the DialogHeader and before the body content**. Use the `banner` prop for full-width styling:

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

- **Clear on reopen**: Error state MUST be reset when a dialog reopens so stale errors don't persist.
- **Clear on resubmit**: Error state MUST be reset at the start of a new submission attempt.
- **Keep errors local**: Error state MUST belong to the component that owns the mutation — errors MUST NOT be propagated up to parent components via callback props.

### When toasts ARE appropriate

Toasts MAY be used for **success** notifications (`useNotifySuccess`) since those are informational and non-critical if missed. Only errors require persistent, inline display.

## Input validation

Input restrictions MUST be communicated via description slots before submission — do not wait for a submit attempt to tell the user what's required.
