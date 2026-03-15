---
"@arizeai/phoenix-cli": minor
---

Add `--curl` support to `px api graphql` so users can print the equivalent
request without executing it. Authorization headers are masked by default, and
`--show-token` can be used to reveal the raw token when explicitly needed.
