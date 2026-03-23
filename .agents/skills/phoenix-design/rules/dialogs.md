# Alert Dialogs

Alert dialogs are interruptive — they block all other interaction until resolved. Use them only when a user must acknowledge important information or confirm a consequential action before proceeding.

## When to use

- Confirming a destructive or irreversible action (delete, discard, overwrite)
- Communicating a critical error that blocks the workflow
- Sharing time-sensitive warnings the user must consider

Do **not** use alert dialogs for success messages, low-signal notifications, or excessive confirmations.

## One at a time

Never nest alert dialogs. Only one should be displayed at any moment. If a flow seems to require sequential decisions, redesign the interaction.

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
- Use the same or similar phrasing as the action that triggered the dialog (e.g., action "Delete conversation" → title "Delete conversation").
- Write as close to a complete sentence as possible (subject + verb). No end punctuation.
- Do **not** ask questions in titles ("Are you sure you want to quit?"). Reframe as the outcome ("Quit application").

### Title examples

| Context | Good | Bad |
|---------|------|-----|
| Confirmation | "Delete 13 files" | "Are you sure?" |
| Error | "Adobe XD needs to restart" | "An error occurred" |
| Destructive | "Discard unsaved changes" | "Do you want to cancel?" |

## Writing the description

- Provide the additional context a user needs to make a decision.
- Write in complete sentences.
- Include error codes in parentheses at the end of the last sentence if applicable (e.g., "Sync isn't running correctly. (Error 50)").

## Writing the actions

- Button labels MUST be specific and actionable — a user should understand the dialog's message from the button label alone.
- Mirror the language from the title when possible (title "Delete conversation" → primary action "Delete").
- Do **not** use generic labels like "Yes" or "No." Use labels that describe what happens ("Delete", "Save as...", "Try again").
- Pair confirmation with distinct actions that give the user control ("Continue" / "Change account", not "Yes" / "No").

### Action examples

| Good | Bad |
|------|-----|
| Delete | Yes |
| Save as... | OK |
| Try again | No |
| Cancel | Dismiss |
