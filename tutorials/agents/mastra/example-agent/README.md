# Mastra Agent Example with Experiments

An AI agent built with [Mastra](https://mastra.ai) that provides weather information, performs calculations, and handles time/timezone queries with integrated Phoenix telemetry.

## Features

This example demonstrates a multi-tool agent with the following capabilities:

- **🌤️ Weather Information**: Get current weather conditions for any location
- **🧮 Mathematical Calculations**: Perform math operations and unit conversions
- **⏰ Time & Timezone Operations**: Handle time queries, conversions, and calculations
- **📊 Telemetry Integration**: Built-in observability with Phoenix tracing and experiments

## Prerequisites

- Node.js >= 20.9.0
- OpenAI API key
- Phoenix instance

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables:**
   ```bash
   export OPENAI_API_KEY="your-openai-api-key"
   export PHOENIX_COLLECTOR_ENDPOINT="http://localhost:6006"  # Your Phoenix instance
   export PHOENIX_API_KEY="your-phoenix-api-key"  # Optional, for Phoenix Cloud
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

![mastra trace](https://storage.googleapis.com/arize-phoenix-assets/assets/images/mastra-trace.png)

4. **Run Phoenix experiments:**
    ```bash
    npx tsx src/mastra/experiments/run_experiment.ts
    ```

![mastra experiment](https://storage.googleapis.com/arize-phoenix-assets/assets/images/mastra-experiment.png)