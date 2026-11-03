---
"@arizeai/phoenix-cli": minor
---

Add `px decision list|get|delete` for saved decisions. `list` shows decisions newest first, filters by `--name` (substring, any case) and a repeatable `--label` that takes a label's name or ID, and caps results with `--limit`. `get <decision-identifier>` shows the latest version, the version a `--tag` points to, or a specific `--version`, which must belong to the named decision; `--tag` and `--version` are mutually exclusive. The pretty output shows the state template, each question with its criteria, choices, or levels, the variables a call must supply, the model, and the version's number and tags. `delete` removes a decision with its versions, tags, and labels behind the deletes gate. A decision an evaluator runs is refused, and in `raw`/`json` mode the refusal on stderr carries `problem_code: conflict` and `problem_reason: referenced_by_evaluator`.
