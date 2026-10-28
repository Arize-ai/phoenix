---
"@arizeai/phoenix-client": minor
"@arizeai/phoenix-cli": minor
---

Accept `DECISION` and `AGENT` as annotator kinds for span, document, trace, session and experiment run annotations. In `px`, `--annotator-kind` on `annotate` and the `*-annotations delete` commands accepts both. Phoenix servers that predate these kinds reject them.
