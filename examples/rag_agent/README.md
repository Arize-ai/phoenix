# Agentic RAG Examples

## Overview

This folder contains examples for building a Retrieval-Augmented Generation (RAG) agent using the LangChain library.

## Features

* Construction of a RAG agent workflow using LangChain
* Integration with OpenAI models for language generation and retrieval
* Example usage of tools such as web search and response analysis, create rag response
* Auto-instrumentation with OpenInference decorators to fully instrument the agent
* End-to-end tracing with Phoenix to track agent performance

## Requirements

* LangChain library
* OpenAI API key
* Langgraph
* Python 3.x
* Gradio (for UI)

## Installation

1. Install the required libraries by running `pip install -r requirements.txt`
2. Run app.py and input the required Keys(OpenAI, Phoenix API Key)

## Usage

1. Run the `app.py` script to start the RAG agent
2. Interact with the agent by providing input and receiving responses

## Files

* `app.py`: The main script for starting the application, this will run the web server with default port(7860)
* `agent.py`: The main script for the RAG agent
* `tools.py`: Contains tools for web search and response analysis, create rag response
* `rag.py`: Contains functions for initializing and using the RAG vector store
* `requirements.txt`: Lists the required libraries for the project

## Notes

* All the Key's must be inputted from the UI application.
* RAG will be loaded with default url in the UI, You can update the url and initialize the project with your own data source.
* This application will support the HTML based sources. 