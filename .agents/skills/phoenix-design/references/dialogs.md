# Alert Dialogs

Alert dialogs are interruptive — they block all other interaction until resolved. They MUST only be used when a user must acknowledge important information or confirm a consequential action before proceeding.

For dialogs that collect input (create, edit, configure), see `form-dialogs.md` instead.

## When to use

- Confirming a destructive or irreversible action (delete project, clear traces, remove data)
- Communicating a critical error that blocks the workflow
- Sharing time-sensitive warnings the user must consider

Alert dialogs MUST NOT be used for success messages, low-signal notifications, or excessive confirmations.

## One at a time

Alert dialogs MUST NOT be nested. Only one SHOULD be displayed at any moment. If a flow seems to require sequential decisions, redesign the interaction.

## Variants

| Variant | Goal | Tone |
|---------|------|------|
| Confirmation | Ask a user to confirm an action they initiated | Instructive |
| Information | Share important info a user must acknowledge | Helpful |
| Warning | Share time-sensitive info that won't block proceeding | Instructive to helpful |
| Destructive | Warn that proceeding may negatively impact data | Instructive |
| Error | Communicate a critical issue that must be resolved before continuing | Supportive |

## Writing the title

- Every alert dialog MUST have a title.
- The title communicates the outcome or effect — not that something "went wrong."
- The title SHOULD use the same or similar phrasing as the action that triggered the dialog (e.g., action "Delete project" → title "Delete project").
- Titles SHOULD be as close to a complete sentence as possible (subject + verb). No end punctuation.
- Titles MUST NOT ask questions ("Are you sure you want to delete this project?"). Reframe as the outcome ("Delete project").

### Title examples

| Context | Good | Bad |
|---------|------|-----|
| Confirmation | "Delete 3 experiments" | "Are you sure?" |
| Error | "Failed to load traces" | "An error occurred" |
| Destructive | "Clear project data" | "Do you want to clear?" |

## Writing the description

- Descriptions MUST provide the additional context a user needs to make a decision.
- Descriptions MUST be written in complete sentences.
- Error codes SHOULD be included in parentheses at the end of the last sentence if applicable.

### Description examples

| Context | Example |
|---------|---------|
| Delete dataset | "This will also delete all associated experiments and traces, and it cannot be undone." |
| Delete API key | "This cannot be undone and will disable all uses of this key." |
| Delete prompt | "This action cannot be undone and all services dependent on this prompt will be affected." |

## Writing the actions

- Button labels MUST be specific and actionable — a user SHOULD be able to understand the dialog's message from the button label alone.
- Labels SHOULD mirror the language from the title when possible (title "Delete experiment" → primary action "Delete experiment").
- Labels MUST NOT use generic words like "Yes" or "No." Use labels that describe what happens ("Delete", "Clear", "Remove data").
- Confirmation SHOULD be paired with distinct actions that give the user control.

### Action examples

| Good | Bad |
|------|-----|
| Delete experiment | Yes |
| Clear project | OK |
| Remove data | No |
| Cancel | Dismiss |

## Button styling

This applies to the action buttons in the footer of any dialog or modal (e.g. inside `DialogFooter`), both alert dialogs and form dialogs (create, edit, configure).

- The primary action — the button that commits the dialog's purpose (Save, Create, Confirm, Submit) — MUST be visually distinguished from the other buttons so it reads as the primary action.
- A non-destructive primary action MUST use `variant="primary"`.
- A destructive primary action (delete, clear, remove data) MUST use `variant="danger"`.
- Cancel, Back, Skip, and other non-committing actions MUST use `variant="default"` or `variant="quiet"`. They MUST NOT use `primary`, `danger`, or other level variants (`success`, `severe`).
- A footer SHOULD distinguish only one action. Emphasize a second button only when the dialog genuinely offers more than one consequential outcome — e.g. a destructive alternative (`danger`) presented alongside the primary action (`primary`). In that case the safe/cancel option MUST remain unemphasized so the two consequential choices stand apart from it.
- For a form's submit button, it is RECOMMENDED to gate the emphasis on dirty state — `variant={isDirty ? "primary" : "default"}` — so the primary action only stands out once there is something to commit.

### Button styling examples

```tsx
// Non-destructive confirm
<DialogFooter>
  <Button variant="default" slot="close">Cancel</Button>
  <Button variant="primary" type="submit">Create</Button>
</DialogFooter>

// Destructive confirm
<DialogFooter>
  <Button variant="default" slot="close">Cancel</Button>
  <Button variant="danger" onPress={onDelete}>Delete project</Button>
</DialogFooter>

// Form submit gated on dirty state
<Button variant={isDirty ? "primary" : "default"} type="submit">Save</Button>
```
