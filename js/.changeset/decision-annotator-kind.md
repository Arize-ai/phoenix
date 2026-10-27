---
"@arizeai/phoenix-client": minor
"@arizeai/phoenix-cli": minor
---

Accept `DECISION` as an annotator kind for span, document, trace, session and experiment run annotations. In `px`, `--annotator-kind` on `annotate` and the `*-annotations delete` commands accepts `DECISION`. Phoenix servers that predate the `DECISION` kind reject it.
