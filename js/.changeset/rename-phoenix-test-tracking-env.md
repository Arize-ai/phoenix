---
"@arizeai/phoenix-client": patch
---

Rename the CI eval testing env var `PHOENIX_TEST_TRACING` to `PHOENIX_TEST_TRACKING` so it matches the internal "tracking" terminology (`isTrackingEnabled`, `SuiteState.trackingDisabled`). The behavior is unchanged: set `PHOENIX_TEST_TRACKING=false` to run a suite locally without syncing datasets, experiments, runs, or annotations to Phoenix.

**Beta breaking change:** if you adopted the beta testing API in 6.11.0 and set `PHOENIX_TEST_TRACING=false`, update it to `PHOENIX_TEST_TRACKING=false`. The old name is no longer read.
