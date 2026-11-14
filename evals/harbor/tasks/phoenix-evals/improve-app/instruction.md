Our support assistant (`/app/support_app.py`) has been making promises our policies don't allow, and it sometimes discusses other customers' orders. It reads its system prompt from the `support-system` prompt in Phoenix.

Can you improve the prompt so the assistant follows the handbook in `/app/policies.md`? There's a `support-questions` dataset in Phoenix with a `baseline` experiment from the current prompt. Save your improved prompt as a new version of `support-system`, and run it as an experiment on `support-questions` so we can compare it with the baseline.

The prompt has to work on new customer questions too, so don't tune it to the ones in the dataset.
