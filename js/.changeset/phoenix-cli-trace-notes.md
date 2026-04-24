---
"@arizeai/phoenix-cli": minor
---

Add trace note support to `px`. New `px trace add-note <trace-id> --text <text>` command creates a trace note, and `--include-notes` is now supported on `px trace get` and `px trace list` to fetch and render trace notes and span notes separately from annotations. Requires Phoenix server >= 14.13.0.
