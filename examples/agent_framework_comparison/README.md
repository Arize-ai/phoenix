# agent-framework-analysis

This project shows the same agent defined in multiple different frameworks:
- Pure Code (aka no framework)
- LangGraph
- LlamaIndex Workflows

More framework examples are in the works, let us know if you have one you want to see!

## Prerequisites
Because this agent is designed to talk to a Phoenix project, you will need to have a Phoenix project with traces in it.
If you don't have a Phoenix project, I recommend running this quickstart before running the agent: https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstarts/tracing_quickstart_openai.ipynb

You'll also need to have an OpenAI API key.

## Setup
To run, set the following environment variables:
- OPENAI_API_KEY=""
- PHOENIX_API_KEY=""
- PHOENIX_CLIENT_HEADERS="api_key="
- PHOENIX_COLLECTOR_ENDPOINT=""

Install packages from the requirements.txt file.

Run the download_traces_from_px.py script to download traces from Phoenix and save them to a local SQLite database.

Start a Phoenix instance if you haven't already. Be sure you've set the PHOENIX_COLLECTOR_ENDPOINT environment variable to the correct endpoint. The PHOENIX_API_KEY and PHOENIX_CLIENT_HEADERS environment variables are only required if you're connecting to a cloud instance of Phoenix.

## Running the Agent
There are three different agents to choose from. Each has its own `main.py` file. Run the whichever one you want to use to launch the agent chat interface.

## Background on the code
Beyond each agent's `main.py` file and `router.py` file, each use some common files:
- `utils/instrument.py` - This file contains the code to instrument each framework depending on the agent you're using.
- `utils/database.py` - This file contains the code to connect to the local SQLite database.
- `prompt_templats/` - Contains the prompt templates for each agent.
- `skills/` - Contains the skills for the code-based and llama-index agents. The LangGraph agents has its own set of skills in its directory, because it requires a slightly different skill structure.
