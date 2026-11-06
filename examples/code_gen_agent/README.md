# Code Generation Agent Example

## Overview

This folder contains examples for building a Code Generation (Code-Gen) agent using the LangChain library. 
This agent is designed to generate, refine, and validate code using OpenAI models. 

## Features

* Construction of a Code-Gen agent workflow using LangChain
* Integration with OpenAI models for generating and refining code
* Example usage of tools such as code analysis, execution, and generation
* Auto-instrumentation with OpenInference decorators to fully instrument the agent
* End-to-end tracing with Phoenix to track agent performance

## Requirements

* LangChain library
* OpenAI API key
* Langgraph (for managing agent logic and workflows)
* Python 3.x
* Gradio (for UI)

## Installation

If you are running this code from inside the `phoenix` repository, we recommend
running it with `uv` to avoid dependency issues.

1. Install `uv`
2. Run `uv run --isolated --with-requirements requirements.txt python app.py`

## Usage

1. Run the `app.py` script to start the RAG agent.
2. Click on the local host link provided in the output.
3. Interact with the agent by entering prompts and receiving generated code responses. 

## Files

* `app.py`: The main script for starting the application, this will run the web server with default port(7860)
* `agent.py`: The main script for the code generation agent
* `tools.py`: Contains tools for code analysis, generation, execution, and merging 
* `requirements.txt`: Lists the required libraries for the project

## Notes

* All the Key's must be inputted from the UI application.
* This application will support the HTML based sources. 