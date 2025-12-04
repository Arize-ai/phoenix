# TypeScript Experiments and Evals with Arize Phoenix

This is a demo application that demonstrates how to run experiments and evaluations in TypeScript with Arize Phoenix. The application uses Arize Phoenix to manage datasets, run experiments, and evaluate LLM outputs.

## Overview

The demo consists of two main files:

- `app.ts`: Contains a space knowledge application that retrieves relevant context from a knowledge base using OpenAI
- `experiment.ts`: Sets up and runs an experiment that evaluates the document relevancy of the retrieved context

## Required Packages

To run this demo, you'll need to install the following packages:

```bash
npm install dotenv openai @arizeai/openinference-instrumentation-openai @ai-sdk/openai @arizeai/phoenix-client @arizeai/phoenix-evals
```

## Setup

1. Install the required packages (see above)

2. Create a `.env` file in the root directory with your API keys:

```env
OPENAI_API_KEY=your-openai-api-key
PHOENIX_HOST=https://app.phoenix.arize.com/s/your-space
PHOENIX_API_KEY=your-phoenix-api-key
```

## Running the Demo

To run the experiment:

```bash
npx tsx experiment.ts
```

## How It Works

1. **app.ts**: Implements a space knowledge retrieval application that:
   - Uses OpenAI's GPT-4o-mini model to retrieve relevant context from a knowledge base
   - Returns 1-3 most relevant pieces of information based on a query

2. **experiment.ts**:
   - Creates a dataset with space-related questions
   - Runs the `spaceKnowledgeApplication` function for each question in the dataset
   - Uses Phoenix Evals to evaluate the retrieved context using a document relevancy evaluator
   - Sends the experiment results to Phoenix Cloud for analysis

The experiment results will be available in your Phoenix Cloud account, where you can analyze the performance of your application and view evaluation metrics.
