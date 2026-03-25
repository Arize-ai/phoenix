---
"@arizeai/phoenix-cli": major
---

Refactor the Phoenix CLI resource commands to a noun-verb format.

This is a breaking change for CLI consumers. Flat commands like `px projects`,
`px traces`, `px spans`, `px datasets`, `px sessions`, `px experiments`, and
`px prompts` have been replaced with singular resource commands and verb
subcommands such as `px project list`, `px trace list`, `px trace get`,
`px span list`, `px dataset list`, `px dataset get`, `px session list`,
`px session get`, `px experiment list`, `px experiment get`, `px prompt list`,
and `px prompt get`.

Help text and documentation were updated to reflect the new command structure.
