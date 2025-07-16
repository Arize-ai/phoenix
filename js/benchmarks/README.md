# Hallucination Evaluator Benchmark

This project benchmarks the quality of the hallucination evaluator in `@arizeai/phoenix-evals` using a curated dataset of factual and hallucinated responses.

## Features

- 📊 **Dataset Management**: Automatically creates and manages hallucination datasets in Phoenix
- 🧠 **Evaluation**: Uses GPT-4o-mini to evaluate responses for hallucinations
- 📈 **Comprehensive Metrics**: Calculates accuracy, precision, recall, F1-score, and execution time
- 🔍 **Detailed Analysis**: Provides confusion matrix and per-example results

## Prerequisites

- Node.js 18+
- OpenAI API key
- Phoenix instance (local or remote)

## Installation

```bash
npm install
```

## Configuration

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

### Run the full benchmark:
```bash
npm run benchmark
```

### Build and run separately:
```bash
npm run build
npm run start
```

## What it does

1. **Dataset Setup**: Creates a dataset called `hallucination-benchmark` in your Phoenix instance with 10 test examples (5 factual, 5 hallucinated)

2. **Evaluation**: Runs the hallucination evaluator on each example, measuring:
   - Response time
   - Classification accuracy
   - Detailed explanations

3. **Analysis**: Provides comprehensive metrics including:
   - Overall accuracy
   - Precision and recall for hallucination detection
   - F1-score
   - Confusion matrix
   - Per-example detailed results

## Example Output

```
🚀 Starting Hallucination Evaluator Benchmark
📊 Setting up dataset in Phoenix...
Dataset 'hallucination-benchmark' already exists with ID: abc123
🧠 Initializing hallucination evaluator...
⚡ Running benchmark...

=== HALLUCINATION EVALUATOR BENCHMARK RESULTS ===
Total Examples: 10
Correct Predictions: 9
Accuracy: 90.00%
Precision: 87.50%
Recall: 87.50%
F1 Score: 87.50%
Average Execution Time: 1250.50ms

=== CONFUSION MATRIX ===
True Positives (Correctly identified hallucinations): 4
False Positives (Incorrectly flagged as hallucinations): 1
True Negatives (Correctly identified factual): 5
False Negatives (Missed hallucinations): 0
```

## Project Structure

```
src/
├── dataset.ts     # Dataset management and Phoenix integration
├── benchmark.ts   # Benchmark execution and metrics calculation
└── index.ts       # Main entry point
```

## Extending the Dataset

You can add more examples by modifying the `HallucinationDataset` class in `src/dataset.ts` or using the `addExamples()` method to append new test cases.

## Dependencies

- `@arizeai/phoenix-client`: Dataset management and Phoenix integration
- `@arizeai/phoenix-evals`: Hallucination evaluation functionality
- `@ai-sdk/openai`: OpenAI model integration for GPT-4o-mini