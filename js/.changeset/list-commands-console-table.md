---
"@arizeai/phoenix-cli": minor
---

Replace verbose box-drawing list output with compact ASCII tables for all `list` commands.

Commands like `px datasets list`, `px experiments list`, `px prompts list`, `px sessions list`,
`px projects list`, and `px annotation-config list` now render results as aligned tabular output
(matching the style of `console.table`) instead of multi-line box-drawing cards. This makes long
lists far easier to scan at a glance. The `--format json` and `--format raw` output is unchanged.
