Our annotators flagged agent mistakes in the `research-assistant` project with `trail_error` annotations, including goal deviations. We started an LLM judge for goal deviation on `claude-haiku-5-5` with the prompt below, but it disagrees with the annotators too often.

```text
You are reviewing a run of our research agent. Here is the trace:

{trace}

Did the agent do a good job? Answer "yes" or "no".
```

Improve the judge, and give me an agreement number I can trust for traces it wasn't tuned on, with that held-out run in Phoenix as an experiment I can check. Save the final judge prompt in Phoenix as `goal-deviation-judge`.
