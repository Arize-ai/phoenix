# TypeScript Experiments Quickstart

This tutorial demonstrates how to run experiments with Phoenix using TypeScript. It shows how to create datasets, define task functions, use code-based and LLM-as-a-Judge evaluators, and compare different versions of an AI agent.

## Overview

This tutorial implements a customer support agent that:

- Classifies support tickets into categories (billing, technical, account, other)
- Retrieves relevant policies based on the classification
- Generates helpful responses to users

The tutorial runs three experiments:

1. **Tool Call Accuracy**: Evaluates the classification tool using a code-based evaluator
2. **Initial Support Agent**: Evaluates the full agent using an LLM-as-a-Judge evaluator
3. **Improved Support Agent**: Compares an improved version of the agent with enhanced instructions and evaluates it with an LLM-as-a-Judge evaluator

## Prerequisites

- Phoenix Cloud account
- OpenAI API key

## Setup

### 1. Install All Dependencies

From this directory, run:

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in this directory:

```env
PHOENIX_HOST=https://app.phoenix.arize.com/s/your-space
PHOENIX_API_KEY=your-phoenix-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 3. Run the Tutorial

```bash
npm start
```

From here, you can view experiment results and traces in Phoenix!

## Documentation

For detailed documentation on experiments, see:

- [Defining the Dataset](https://docs.phoenix.arize.com/docs/phoenix/datasets-and-experiments/tutorial/defining-the-dataset)
- [Run Experiments with Code Evals](https://docs.phoenix.arize.com/docs/phoenix/datasets-and-experiments/tutorial/run-experiments-with-code-evals)
- [Run Experiments with LLM as a Judge](https://docs.phoenix.arize.com/docs/phoenix/datasets-and-experiments/tutorial/run-experiments-with-llm-judge)
- [Iterating with Experiments](https://docs.phoenix.arize.com/docs/phoenix/datasets-and-experiments/tutorial/iteration-workflow-experiments)

