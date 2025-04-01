# Phoenix RAG Chat Setup Guide

This guide explains how to set up and run the Phoenix RAG chat system, which consists of two main components:
- A FastAPI server that interfaces with Phoenix (`phoenix_fastapi_server.py`)
- A RAG-based chat client (`phoenix_rag_chat.py`)

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Installation

1. Create and activate a virtual environment (recommended):
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

2. Install required packages:
```bash
# Install from requirements.txt
pip install -r requirements.txt
```

## Configuration

1. Set required environment variables:
```bash
# OpenAI API key for the chat functionality
export OPENAI_API_KEY='your-key-here'

# Phoenix project name (important: customize this for your project)
export PHOENIX_PROJECT_NAME='your-project-name'

# Phoenix URL (default: http://localhost:6006)
export PHOENIX_URL='http://localhost:6006'
```

## Starting the Services

1. First, ensure your Phoenix server is running:
```bash
python -m phoenix.server.main serve
```

2. Start the FastAPI server:
```bash
python phoenix_fastapi_server.py
```
This will start the server on `http://localhost:5174`

3. In a new terminal, run the RAG chat client:
```bash
python phoenix_rag_chat.py
```

## Usage

Once both services are running, you can interact with the chat client by:
- Asking about recent traces: "Show me recent traces"
- Querying specific traces: "Show me details for trace ID xyz123"

## Troubleshooting

- If you see connection errors, ensure both the Phoenix server and FastAPI server are running
- Verify your `PHOENIX_PROJECT_NAME` matches your actual Phoenix project
- Check that the `PHOENIX_URL` points to your running Phoenix instance
- If you encounter package conflicts, try creating a fresh virtual environment
- For package-specific issues, ensure all requirements are properly installed:
  ```bash
  pip list | grep -E "fastapi|uvicorn|phoenix-cli|openai|httpx|pandas|pydantic"
  ```


  Example output
  phoenix) amankhan@Amans-Air phoenix % python phoenix_rag_chat.py

--- Phoenix RAG Chatbot ---
Ask questions about your Phoenix traces (Ctrl+C to exit)

You: find the most recent trace and then get info about it

Planner thinking...
Planner Response: {"tool": "list_traces", "args": {"limit": 1}}

Executing tool 'list_traces' with args: {'limit': 1} via HTTP...
Tool execution successful via HTTP.

Planner thinking...
Planner Response: {"tool": "get_trace", "args": {"trace_id": "ae74b5b79c8ffdfd64a379508e0a6bf9"}}

Executing tool 'get_trace' with args: {'trace_id': 'ae74b5b79c8ffdfd64a379508e0a6bf9'} via HTTP...
Tool execution successful via HTTP.

Answering LLM thinking...

Bot: The most recent trace available is identified by the trace ID "ae74b5b79c8ffdfd64a379508e0a6bf9" for the project "openai-chat." 

Here are the details of the trace:

- **Span Name**: ChatCompletion
- **Span Kind**: LLM
- **Start Time**: April 1, 2025, 14:23:05 UTC
- **End Time**: April 1, 2025, 14:23:05 UTC
- **Status Code**: OK
- **Token Count (Completion)**: 13
- **Token Count (Total)**: 27
- **Model Name**: gpt-3.5-turbo-0125
- **Input Value**: 
  ```json
  {
    "messages": [
      {
        "role": "user",
        "content": "Write a haiku about observability"
      }
    ],
    "model": "gpt-3.5-turbo"
  }
  ```
- **Output Value**: 
  ```json
  {
    "id": "chatcmpl-BHWo55CiN9GM96dStEvBSsj7exCaW",
    "choices": [
      {
        "finish_reason": "stop",
        "index": 0,
        "logprobs": null,
        "message": {
          "content": "data streams flowing\ninsightful patterns emerge\nobservability",
          "role": "assistant"
        }
      }
    ],
    "created": 1743517385,
    "model": "gpt-3.5-turbo-0125",
    "object": "chat.completion",
    "service_tier": "default",
    "usage": {
      "completion_tokens": 13,
      "prompt_tokens": 14,
      "total_tokens": 27
    }
  }
  ```
- **Input Mime Type**: application/json
- **Output Mime Type**: application/json

This trace captures a request to generate a haiku about observability, which was successfully processed.
