---
"@arizeai/phoenix-cli": minor
"@arizeai/phoenix-client": minor
---

Continuous annotation configs and evaluator outputs take an optional `threshold`, the score separating good from bad results (the bounds' midpoint when unset). `px annotation-config create|update --threshold` now accepts it for CONTINUOUS configs as well as FREEFORM.
