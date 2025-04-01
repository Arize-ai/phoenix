import asyncio
import json
import os
from openai import AsyncOpenAI
import httpx # Use httpx directly
import re
from typing import Dict, Optional

# --- Configuration ---
MCP_SERVER_URL = "http://localhost:5174" # Use port 5174
CALL_TOOL_ENDPOINT = f"{MCP_SERVER_URL}/call_tool" # Will use port 5174
PLANNER_MODEL = "gpt-4o-mini"
ANSWER_MODEL = "gpt-4o-mini"
# Ensure OPENAI_API_KEY is set in your environment variables
# export OPENAI_API_KEY='your-key-here'

# --- Initialize OpenAI Client ---
try:
    openai_client = AsyncOpenAI()
    # Test connection implicitly later
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    print("Please ensure OPENAI_API_KEY is set correctly.")
    exit()

# --- Tool Description for Planner LLM ---
# Keep this updated if you change tools in phoenix_mcp_server.py
PHOENIX_TOOLS_DESCRIPTION = """
Available tools to query Phoenix observability data:

1.  **`list_traces`**:
    *   Description: "List recent root spans (traces) using the Phoenix Python client."
    *   Arguments:
        *   `limit` (integer, default: 5): How many recent traces to list.
        *   `minutes_ago` (integer, default: 60): How far back in minutes to look for traces.
    *   Use this tool when the user asks for recent traces, a summary of activity, or doesn't specify a particular trace ID.
    *   After using this tool, you can use get_trace to fetch details about any interesting traces found.

2.  **`get_trace`**:
    *   Description: "Get all spans for a specific trace ID using the Phoenix Python client."
    *   Arguments:
        *   `trace_id` (string, required): The specific ID of the trace to retrieve details for. Trace IDs look like '4b46e32db9349e7436d236593c2e4e58'.
    *   Use this tool ONLY when you have a specific trace ID (either from the user or from a previous list_traces response).

You must respond ONLY with a JSON object specifying the tool to use and its arguments, like this:
{"tool": "tool_name", "args": {"arg_name": "value", ...}}

Tool Selection Strategy:
1. If no specific trace ID is provided and no previous context exists, use list_traces first
2. If you see a trace ID in the previous tool response that seems relevant, use get_trace with that ID
3. If you already have detailed trace information or encounter an error, respond with {"tool": "none", "args": {}}

Example of chaining:
1. User asks about recent activity
2. Use list_traces to get overview
3. If interesting trace found, use get_trace to get details
"""

async def plan_step(user_query: str) -> Dict | None:
    """Uses an LLM to decide which tool to call."""
    print("\nPlanner thinking...")
    prompt = f"{PHOENIX_TOOLS_DESCRIPTION}\n\nUser question: {user_query}\n\nWhich tool should be used? Respond ONLY with the JSON object."

    try:
        response = await openai_client.chat.completions.create(
            model=PLANNER_MODEL,
            messages=[
                {"role": "system", "content": "You are a planning agent selecting the correct tool and arguments based on user queries about Phoenix trace data."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            response_format={"type": "json_object"} # Use JSON mode
        )
        plan_json_str = response.choices[0].message.content
        print(f"Planner Response: {plan_json_str}")
        plan = json.loads(plan_json_str)
        if plan.get("tool") and plan.get("tool") != "none":
             # Basic validation
             if not isinstance(plan.get("args"), dict):
                  print("Planner Error: 'args' is not a dictionary.")
                  return None
             return plan
        else:
             print("Planner decided no tool is applicable.")
             return None
    except json.JSONDecodeError:
        print(f"Planner Error: Could not parse JSON response: {plan_json_str}")
        return None
    except Exception as e:
        print(f"Planner Error: {e}")
        return None

async def execute_tool(tool_name: str, args: Dict) -> str:
    """Executes the chosen tool by making an HTTP POST request to the FastMCP server."""
    print(f"\nExecuting tool '{tool_name}' with args: {args} via HTTP...")
    payload = {
        "tool": tool_name,
        "args": args
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                CALL_TOOL_ENDPOINT,
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=60.0 # Increase timeout slightly for potentially longer queries
            )
            response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
            tool_result = response.json() # Expecting JSON response from FastMCP /call_tool

            print("Tool execution successful via HTTP.")
            # FastMCP typically returns {"result": "...", "request_id": "..."}
            # We want the nested "result" which contains the JSON string from our tool
            if "result" in tool_result:
                return tool_result["result"]
            else:
                 print("Warning: Tool response did not contain 'result' key.")
                 return json.dumps(tool_result) # Return the whole response if format unexpected

    except httpx.RequestError as e:
        print(f"Tool Execution HTTP Request Error: Could not connect to MCP server at {CALL_TOOL_ENDPOINT}. Error: {e}")
        return json.dumps({"error": f"Failed to connect to MCP Server: {str(e)}"})
    except httpx.HTTPStatusError as e:
        print(f"Tool Execution HTTP Status Error: Received status {e.response.status_code} from MCP server. Response: {e.response.text}")
        return json.dumps({"error": f"MCP Server returned error {e.response.status_code}", "detail": e.response.text})
    except Exception as e:
        print(f"Tool Execution Error: {e}")
        return json.dumps({"error": f"Failed to execute tool '{tool_name}' via HTTP: {str(e)}"})

async def answer_step(user_query: str, tool_result_json: str | None) -> str:
    """Uses an LLM to generate a final answer based on the query and retrieved data."""
    print("\nAnswering LLM thinking...")

    if tool_result_json:
        try:
             # Try to pretty print for the prompt
             context_data = json.dumps(json.loads(tool_result_json), indent=2)
        except json.JSONDecodeError:
             context_data = tool_result_json # Use raw string if not valid JSON

        prompt = f"""Answer the user's question based *only* on the provided context data from Phoenix.
If the context indicates an error, explain the error. Do not make up information.

Context Data:
```json
{context_data}
```

User Question: {user_query}

Answer:"""
    else:
        # Case where the planner decided no tool was needed
        prompt = f"""The user asked a question, but no specific tool was applicable to fetch data from Phoenix.
Explain that you can primarily answer questions about recent traces or specific trace details if an ID is provided.

User Question: {user_query}

Response:"""

    try:
        response = await openai_client.chat.completions.create(
            model=ANSWER_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant answering questions about Phoenix observability data based *only* on the context provided."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
        )
        answer = response.choices[0].message.content
        return answer
    except Exception as e:
        print(f"Answering LLM Error: {e}")
        return "Sorry, I encountered an error trying to generate an answer."

async def main():
    """Main chat loop."""
    print("\n--- Phoenix RAG Chatbot ---")
    print("Ask questions about your Phoenix traces (Ctrl+C to exit)")
    if not os.getenv("OPENAI_API_KEY"):
        print("\nERROR: OPENAI_API_KEY environment variable not set.")
        return

    while True:
        try:
            user_input = input("\nYou: ")
            if user_input.lower() in ["exit", "quit"]:
                break

            # Initialize context for the planner
            context = ""
            tool_result_data = None
            max_iterations = 3  # Prevent infinite loops
            iteration = 0

            while iteration < max_iterations:
                # Update the prompt with previous context if any
                current_query = user_input
                if context:
                    current_query = f"{user_input}\n\nPrevious tool response:\n{context}"

                # 1. Plan which tool to use
                plan = await plan_step(current_query)
                
                if not plan or plan.get("tool") == "none":
                    break

                # 2. Execute the tool
                tool_result_data = await execute_tool(plan["tool"], plan["args"])
                
                # Update context for next iteration
                try:
                    result_json = json.loads(tool_result_data)
                    context = json.dumps(result_json, indent=2)
                except json.JSONDecodeError:
                    context = tool_result_data

                # If this was a get_trace call or there's an error, stop iterating
                if plan["tool"] == "get_trace" or "error" in context.lower():
                    break
                
                iteration += 1

            # 3. Generate the final answer
            final_answer = await answer_step(user_input, tool_result_data)
            print(f"\nBot: {final_answer}")

        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"\nAn unexpected error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 