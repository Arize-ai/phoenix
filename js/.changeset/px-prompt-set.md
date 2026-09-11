---
"@arizeai/phoenix-cli": minor
---

Add `px prompt set` to create a prompt or append a new version. Pass `--template`, repeatable `--message role:content`, or `--json` (path to a JSON prompt body, or `-` for stdin). Creating a prompt requires both `--model` and `--model-provider`; on update, omitted fields are copied from the latest version.
