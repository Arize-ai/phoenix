---
type: llm
focus: last_message
weight: 1
---
The user asked why a LangGraph agent loops forever. The bug is in `should_continue`: it returns "tools" whenever `state["messages"]` is non-empty, which is always, instead of checking whether the last AI message contains tool calls. Nothing in the question mentions Phoenix, Arize, or tracing. Score against these claims; each must hold for a pass.

1. The response identifies that the routing condition checks the message list for truthiness rather than inspecting the last message for `tool_calls`, so it always routes to "tools".
2. The response shows a corrected `should_continue` (for example: `last = state["messages"][-1]; return "tools" if getattr(last, "tool_calls", None) else END`) or the equivalent prebuilt `tools_condition`.
3. The main body of the answer is about the LangGraph code. It contains no `px` commands and no walkthrough of Arize Phoenix or OpenInference tracing. A single sentence suggesting the user could trace the graph to see the loop is acceptable; anything longer fails this claim.
