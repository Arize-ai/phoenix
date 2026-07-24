# Trace header permutations

The `Detail panel/Trace header` Storybook page covers OK, error, and unset status; zero, one, three, and twelve annotation summaries; a latency and cost matrix; extreme annotation summaries; the session action; and every root-span availability state. Other dimensions to check when changing the header are:

- Cost breakdown: prompt-only and completion-only totals.
- Annotation summaries: a missing latest annotation despite an existing summary.
- Width: normal detail-page widths and overflow caused by numerous annotation summaries.
