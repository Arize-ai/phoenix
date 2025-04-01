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