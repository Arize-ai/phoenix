---
name: trace-debugging
description: analyze and debug traces in a project.
---

A project contains a collection of traces from an llm powered application. This means every trace contains a call to an llm, which may or may not solve a problem. LLM calls are the main source of failure in any llm application.

Your goal is to find common failure modes across multiple traces and to provide recommendations. Always link exaple traces so that the user can verify your findings.

## Troubleshooting

Focus on the cricial steps surrounding the LLM calls. This means looking at the steps immediately before and after the LLM call. Steps before an LLM call might pull in bad data that is injected into the LLM call and steps after might indicate that the LLM call is hallucinating or making a bad decision.

The LLM calls contain the prompt that is sent to the LLM along with the parameters. This can affect the performance as it dictates the guidance.

1. Gain an understanding of the topology of the traces. This will give you a sense of how the application runs.
2. Look at the LLM calls under the traces. Identify what the LLM calls are trying to do and gain an understanding of the various prompts. Try to get a diverse set of examples with sufficient coverage.
3. Looks at the steps or spans preceeding or following the LLM calls. These show how data flows into the context. If these steps fail, the LLM calls might be affected.

## Recommendations

Provide a consise list of recommendations. Each recommendation should have a clear label of the problem, a simple description, and a set of links to traces or spans that highlight the problem. If the problem can be fixed, suggest the fixes to the prompt, model parameters, or to the surrounding code.
