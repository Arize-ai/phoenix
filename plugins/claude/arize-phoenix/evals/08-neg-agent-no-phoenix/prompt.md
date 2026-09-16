---
max_turns: 6
timeout_seconds: 180
allowed_tools: [Skill]
runs: 3
---
My LangGraph agent never finishes. It bounces between the planner node and the tool node forever until I hit the recursion limit. The tool results come back fine, the model even produces a final answer with no tool calls, but the graph still routes back to tools. Here's the routing code. What am I doing wrong?

```python
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

def should_continue(state: AgentState):
    if state["messages"]:
        return "tools"
    return END

graph = StateGraph(AgentState)
graph.add_node("planner", call_model)
graph.add_node("tools", ToolNode(tools))
graph.set_entry_point("planner")
graph.add_conditional_edges("planner", should_continue, {"tools": "tools", END: END})
graph.add_edge("tools", "planner")
app = graph.compile()
```
