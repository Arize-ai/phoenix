---
"@arizeai/phoenix-client": patch
"@arizeai/phoenix-cli": patch
---

Decision evaluator definitions describe their version as `decision: { decision_id, selector, resolved_decision_version_id }`, the same shape LLM evaluators use for `prompt`. `px evaluator list|get` shows a decision evaluator's version, or `latest (<id>)` when it runs the decision's newest version.
