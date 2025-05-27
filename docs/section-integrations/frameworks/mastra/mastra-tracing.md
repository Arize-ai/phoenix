# Mastra Tracing

## Launch Phoenix

{% tabs %}
{% tab title="Phoenix Cloud" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**```bash
npm install @arizeai/openinference-mastra
```

**Set your Phoenix endpoint and API Key:**

```typescript
import { config } from 'dotenv';
config();

// Add Phoenix API Key for tracing
const PHOENIX_API_KEY = process.env.PHOENIX_API_KEY;
process.env.PHOENIX_CLIENT_HEADERS = `api_key=${PHOENIX_API_KEY}`;
process.env.PHOENIX_COLLECTOR_ENDPOINT = "https://app.phoenix.arize.com";
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

**Install packages:**

```bash
npm install @arizeai/openinference-mastra
```

**Set your Phoenix endpoint:**

```typescript
process.env.PHOENIX_COLLECTOR_ENDPOINT = "http://localhost:6006";
```

See Terminal for more details
{% endtab %}

{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

**Install packages:**

```bash
npm install @arizeai/openinference-mastra
```

**Set your Phoenix endpoint:**

```typescript
process.env.PHOENIX_COLLECTOR_ENDPOINT = "http://localhost:6006";
```

For more info on using Phoenix with Docker, see [Docker](https://docs.arize.com/phoenix/self-hosting/deployment-options/docker).
{% endtab %}

## Setup

Initialize OpenTelemetry tracing for your Mastra application:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { MastraInstrumentation } from '@arizeai/openinference-mastra';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-proto';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'my-mastra-app',
    [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.PHOENIX_COLLECTOR_ENDPOINT + '/v1/traces',
    headers: process.env.PHOENIX_CLIENT_HEADERS ? 
      { 'api_key': process.env.PHOENIX_API_KEY } : {},
  }),
  instrumentations: [new MastraInstrumentation()],
});

sdk.start();
```

## Run Mastra

From here you can use Mastra as normal. All agents, workflows, and tool calls will be automatically traced.

### Basic Agent Example

```typescript
import { Agent } from 'mastra';
import { openai } from 'mastra/llm';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'You are a helpful AI assistant.',
  model: openai('gpt-4o-mini'),
});

// This will be automatically traced
const response = await agent.generate('What is the capital of France?');
console.log(response);
```

### Workflow Example

```typescript
import { Workflow, createStep } from 'mastra';
import { openai } from 'mastra/llm';

const workflow = new Workflow({
  name: 'content-generation',
});

const generateIdeas = createStep({
  id: 'generate-ideas',
  execute: async ({ input }) => {
    const model = openai('gpt-4o-mini');
    const result = await model.generate({
      prompt: `Generate 3 creative ideas for: ${input.topic}`,
    });
    return { ideas: result.text };
  },
});

const refineIdeas = createStep({
  id: 'refine-ideas',
  execute: async ({ input }) => {
    const model = openai('gpt-4o-mini');
    const result = await model.generate({
      prompt: `Refine and expand on these ideas: ${input.ideas}`,
    });
    return { refinedIdeas: result.text };
  },
});

workflow
  .step(generateIdeas)
  .then(refineIdeas)
  .commit();

// This workflow execution will be traced
const run = await workflow.createRun();
const result = await run.execute({ topic: 'sustainable technology' });
```

### Agent with Tools Example

```typescript
import { Agent, createTool } from 'mastra';
import { openai } from 'mastra/llm';

const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'The city name' },
    },
    required: ['location'],
  },
  execute: async ({ location }) => {
    // Mock weather API call
    return {
      location,
      temperature: '22°C',
      condition: 'Sunny',
    };
  },
});

const agent = new Agent({
  name: 'Weather Assistant',
  instructions: 'You help users get weather information.',
  model: openai('gpt-4o-mini'),
  tools: [weatherTool],
});

// Tool calls will be traced as part of the agent execution
const response = await agent.generate('What\'s the weather like in Paris?');
```

### RAG Example

```typescript
import { Agent, createVectorQueryTool } from 'mastra';
import { openai } from 'mastra/llm';
import { PineconeVector } from 'mastra/vector';

const vectorStore = new PineconeVector({
  apiKey: process.env.PINECONE_API_KEY!,
  indexName: 'knowledge-base',
});

const queryTool = createVectorQueryTool({
  vectorStore,
  embeddingModel: openai('text-embedding-3-small'),
});

const ragAgent = new Agent({
  name: 'Knowledge Assistant',
  instructions: 'Answer questions using the provided knowledge base.',
  model: openai('gpt-4o-mini'),
  tools: [queryTool],
});

// RAG queries and responses will be traced
const response = await ragAgent.generate('Tell me about machine learning');
```

## Observe

Now that you have tracing setup, all invocations of your Mastra agents, workflows, tools, and LLM calls will be streamed to your running Phoenix for observability and evaluation.

### What Gets Traced

The Mastra instrumentation automatically captures:

- **Agent Executions**: Complete agent runs including instructions, model calls, and responses
- **Workflow Steps**: Individual step executions within workflows, including inputs, outputs, and timing
- **Tool Calls**: Function calls made by agents, including parameters and results
- **LLM Interactions**: All model calls with prompts, responses, token usage, and metadata
- **RAG Operations**: Vector searches, document retrievals, and embedding generations
- **Memory Operations**: Agent memory reads and writes
- **Error Handling**: Exceptions and error states in your AI pipeline

### Trace Attributes

Phoenix will capture detailed attributes for each trace:

- **Agent Information**: Agent name, instructions, model configuration
- **Workflow Context**: Workflow name, step IDs, execution flow
- **Tool Metadata**: Tool names, parameters, execution results
- **Model Details**: Model name, provider, token usage, response metadata
- **Performance Metrics**: Execution time, token counts, costs
- **User Context**: Session IDs, user information (if provided)

You can view all of this information in the Phoenix UI to debug issues, optimize performance, and understand your application's behavior. 

