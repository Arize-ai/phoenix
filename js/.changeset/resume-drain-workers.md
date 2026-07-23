---
"@arizeai/phoenix-client": patch
---

Fix `resumeExperiment` and `resumeEvaluation` leaking detached workers on the first error. Both used `Promise.all([producer, ...workers])`, which rejects the instant one worker throws (e.g. under `stopOnFirstError`) while the remaining concurrent workers and the producer keep running — hitting the API and logging after the function has already returned or thrown. They now drain every task with `Promise.allSettled` and classify rejections by priority, so no background work outlives the call. This also fixes intermittent CI teardown errors (`Closing rpc while "onUserConsoleLog" was pending`) caused by that late console output.
