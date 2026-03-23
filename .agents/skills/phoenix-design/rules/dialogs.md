# Alert Dialogs

Alert dialogs are interruptive — they block all other interaction until resolved. They MUST only be used when a user must acknowledge important information or confirm a consequential action before proceeding.

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
