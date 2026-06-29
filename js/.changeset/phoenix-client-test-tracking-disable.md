---
"@arizeai/phoenix-client": patch
---

Fix `PHOENIX_TEST_TRACKING=false` not reliably disabling recording in vitest/jest eval suites. The flag is now read robustly (tolerating surrounding quotes and whitespace) and latches off for the whole process the first time it is seen disabled, so one suite can no longer re-enable recording for the others by mutating the environment mid-run. The run and annotation upload paths also honor the flag directly as a safeguard.
