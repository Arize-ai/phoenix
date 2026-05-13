---
name: trace-debugging
description: Systematically investigate failing or slow traces in a Phoenix project. Use when the user asks why a span errored, why latency is high, why a tool call produced the wrong result, or any variant of "what went wrong" / "where do I look" inside a project's traces. Walks through narrowing with set_time_range and set_spans_filter, then inspecting span attributes for the failure signature.
---

# Trace Debugging

A repeatable loop for investigating failures inside a Phoenix project. The
goal is to converge on a concrete failure signature — not just "it's slow" or
"the LLM hallucinated" — so the user can decide what to fix or evaluate next.

## When to Apply

Trigger this workflow when the user is looking at a Phoenix project and asks
any variant of:

- "Why did this trace fail?"
- "What's making latency high?"
- "Which spans are erroring?"
- "Where do I focus?"

## Loop

1. **Frame the question.** Get one concrete thing to look for: an error
   substring, a latency threshold, a tool name, a model name, an output shape.
   Vague intent ("look at failures") becomes a vague filter and a vague answer.

2. **Narrow the window.** Use `set_time_range` to clamp to the smallest window
   that still contains the behavior. A 24-hour view hides patterns that a
   1-hour view exposes.

3. **Narrow the spans.** Use `set_spans_filter` to keep only spans that match
   the frame. Start broad (`status_code == 'ERROR'`), then layer constraints
   (`span_kind == 'LLM'`, attribute predicates) as you learn what the failure
   class actually is.

4. **Read a few end-to-end.** Pick 3–5 surviving traces and read them top to
   bottom. Patterns at the trace level (e.g. retriever returned empty, tool
   args malformed, model retried 4×) only show up when you see the sequence.

5. **Name the failure.** Write down the signature in one sentence:
   *"Retriever returns zero docs when the query contains a date range, so the
   LLM fabricates an answer."* If you can't write that sentence, you haven't
   narrowed enough — return to step 3.

6. **Decide the next move.** A named failure points at exactly one of:
   instrument the gap, fix the code, write an eval that catches the class, or
   collect a dataset. Don't skip naming — undirected fixes are how regressions
   come back.

## Anti-patterns

- **Scrolling without a frame.** Looking at the trace list with no filter is
  triage, not debugging. Always commit to one question before looking.
- **One trace, one conclusion.** A single failing trace tells you a failure
  exists. It does not tell you the class. Inspect a handful before naming.
- **Filtering on output text.** Output strings are noisy and vary per call.
  Filter on structural attributes (status, span kind, tool name, model name)
  first; use output substrings only to confirm a hypothesis.
