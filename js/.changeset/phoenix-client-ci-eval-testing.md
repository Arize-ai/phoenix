---
"@arizeai/phoenix-client": minor
---

**Beta:** Add a vitest/jest-based CI eval testing API to `@arizeai/phoenix-client`. New `./vitest`, `./vitest/reporter`, `./jest`, and `./jest/reporter` entrypoints expose a Phoenix reporter (scoreboard + results table), acceptance-criteria support with an optimization `direction` ("maximize"/"minimize"), and tracing that records runs back to Phoenix. `jest` and `vitest` are added as optional peer dependencies.

This API is in beta and may change in a future release.
