---
description: >-
  In this tutorial, we’ll run a Mastra agent and build a custom evaluator for
  it. The goal is to understand the workflow for creating evaluators that align
  with specific use cases.
---

# Aligning LLM Evals with Human Annotations (TypeScript)

{% embed url="https://youtu.be/RsFDe-sVcNE?si=jVmkqPKN2OTfent2" %}

In this tutorial, you’ll learn how to align your evaluator so it’s tailored to your specific use case. Instead of relying only on [pre-built evaluators](https://arize.com/docs/phoenix/evaluation/how-to-evals/running-pre-tested-evals) in Phoenix—which are tested on general benchmark datasets but may miss the nuances of your application—we’ll show you how to build your own.

We’ll run a [**Mastra**](https://app.gitbook.com/s/C8re8QzKV5m48pbcFkBp/typescript/mastra) **agent**, capture its traces, and then run evaluations on those traces. Using a small set of **human-annotated examples** as our ground truth, we’ll identify where the evaluator falls short. From there, we’ll refine the evaluation prompt and repeat the cycle until the evaluator’s outputs align with the human annotations.

This iterative loop—**run agent → gather traces → evaluate → refine**—ensures your evaluator evolves to match the exact requirements of your application.&#x20;

***

## Notebook Walkthrough

{% hint style="success" %}
Access the notebook and agent here: [https://github.com/s-yeddula/phoenix-align-evals-ts/tree/main](https://github.com/s-yeddula/phoenix-align-evals-ts/tree/main)
{% endhint %}

We will go through key code snippets on this page. To follow the full tutorial, check out the notebook or video above.&#x20;

## Creating a dataset <a href="#creating-a-dataset" id="creating-a-dataset"></a>

Grab the Mastra agent traces from Phoenix and format them into dataset examples. In this example, we’ll extract the user query, the tool calls, and the agent’s final response. Once formatted, we’ll upload this dataset back into Phoenix for evaluation.

```typescript
const agentSpans = await getSpans({
    client: client,
    project: { projectName: "mastra-orchestrator-workflow" },
    limit: 1000
  });
```

```typescript
// Group spans by trace ID
function groupSpansByTraceId(spans: any[]) {
  const traceGroups: { [traceId: string]: any[] } = {};
  
  spans.forEach(span => {
    const traceId = span.context?.trace_id || span.traceId || 'unknown';
    
    if (!traceGroups[traceId]) {
      traceGroups[traceId] = [];
    }
    
    traceGroups[traceId].push(span);
  });
  
  return traceGroups;
}

// Group the spans
const groupedSpans = groupSpansByTraceId(agentSpans.spans || []);
const traceIds = Object.keys(groupedSpans);
```

```typescript
// Create dataset examples with user query as input and ai.toolCall spans as output
const datasetExamples = traceAnalysis.map(trace => {
  // Extract user query from first span's input.value
  const userQuery = trace.spans[0]?.attributes?.['input.value'] || 'User query not found';
  
  // Extract agent response from first span's output.value
  const agentResponse = trace.spans[0]?.attributes?.['output.value'] || 'Agent response not found';
  
  // Filter spans where name = "ai.toolCall"
  const aiToolCallSpans = trace.spans.filter(span => span.name === 'ai.toolCall');
  
  return {
    input: {
      userQuery
    },
    output: {
      agentResponse: agentResponse,
      aiToolCallCount: aiToolCallSpans.length,
      aiToolCallSpans: aiToolCallSpans.map(span => ({
        spanId: span.spanId,
        name: span.name,
        duration: span.duration || 0,
        attributes: span.attributes
      }))
    },
    metadata: {
      traceId: trace.traceId,
      source: 'mastra-orchestrator-workflow',
      timestamp: trace.startTime
    }
  };
```

### Upload dataset to Phoenix

```typescript
const { datasetId } = await createDataset({
  name: `mastra-orchestrator-traces-${Date.now()}`,
  description: "Traces from Mastra orchestrator workflow",
  examples: datasetExamples
});

const dataset = await getDataset({ dataset: { datasetId } });
```

## Annotate dataset examples

Next, we need human annotations to serve as ground truth for evaluation. To do this, we’ll add an annotation field in the `metadata` of each dataset example. This way, every example includes a reference label that our evaluator outputs can be compared against.

In this example, we’ll evaluate how well the agent’s final response aligns with the tool calls and their outputs. We’ll use three labels for evaluation: `aligned`, `partially_aligned`, and `misaligned`.

You can adapt this setup to other evaluation criteria as needed.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/align-evals-1.png" %}

## LLM Judge Improvement Cycle

Now we’ll start with a basic evaluation prompt and improve it iteratively. The workflow looks like this:

**Run the evaluator --> Inspect the outputs and experiment results --> Update the evaluation prompt based on what’s lacking --> Repeat until performance improves**

We’ll use Phoenix experiments to identify weaknesses in the evaluator, review explanations, and track performance changes over time.

In this tutorial, we’ll go through two improvement cycles, but you can extend this process with more iterations to fine-tune the evaluator further.

### Write baseline LLM judge prompt

```typescript
const evalPromptTemplateV1 = `
You are evaluating whether the agent's final response matches the tool outputs.

DATA:
- Query: {{query}}
- Tool Outputs & Response: {{data}}

Choose one label:
- "aligned"
- "partially_aligned"
- "misaligned"

Output only the label.
`;
```

### Define experiment task and evaluator

```typescript
import { type RunExperimentParams } from "npm:@arizeai/phoenix-client/experiments";
import { createClassificationEvaluator } from "npm:@arizeai/phoenix-evals@latest";

const task: RunExperimentParams["task"] = async (example) => {
    const query = example.input.userQuery;
    const agentData = JSON.stringify(example.output, null, 2); // format tool outputs nicely
    
    const evaluator = await createClassificationEvaluator({
        model: openaiModel,
        choices: { aligned: 1, misaligned: 0, partially_aligned: 0.5 },
        promptTemplate: evalPromptTemplateV1,
    });

    const result = await evaluator.evaluate({
    query: query,
    data: agentData,
    });

    console.log({
        exampleId: example.id,
        query,
        label: result.label,
        score: result.score,
        explanation: result.explanation,
     });
  
  return result;
};
```

```typescript
const matchesAnnotation = asEvaluator({
  name: "matches_annotation",
  kind: "CODE",
  evaluate: async ({ metadata, output }) => {
    const annotation = metadata.annotation;
    const evalLabel = output.label;

    const isMatch = annotation === evalLabel;

    return {
      score: isMatch ? 1.0 : 0.0,
      label: isMatch ? "match" : "mismatch",
      metadata: { annotation, evalLabel },
      explanation: isMatch
        ? `The output label matches the annotation ("${annotation}").`
        : `The output label ("${evalLabel}") does not match the annotation ("${annotation}").`
    };
  }
});
```

### Run experiment

```typescript
const experiment = await runExperiment({
  client,
  experimentName: "evalTemplateV1",
  dataset: {datasetId: datasetId},
  task,
  evaluators: [matchesAnnotation],
  logger: console,
});
```

### Make refinements

After observing results in Phoenix, you can make improvements to your evaluation prompt:&#x20;

```typescript
const evalPromptTemplateV2 = `
You are evaluating how well an agent's FINAL RESPONSE aligns with the TOOL OUTPUTS it used.

You will be given:
- The original user query
- The agent’s final response
- The tool outputs produced by the agent

QUERY:
{{query}}

TOOL + RESPONSE DATA:
{{data}}

Choose exactly ONE label:

- "aligned" → The final response is fully supported by the tool outputs.
  * Every piece of information in the response can be traced back to the tool calls.
  * There are no additions, fabrications, or contradictions.

- "partially_aligned" → The final response mixes correct tool-based information with extra or inconsistent details.
  * Some information in the response comes from tool outputs, but other parts are missing, fabricated, or inconsistent.
  * The response is only partially grounded in the tool calls.

- "misaligned" → The final response ignores, contradicts, or invents information unrelated to the tool outputs.
  * The tool outputs do not support the response at all, or the response is in direct conflict with them.

Guidelines:
- Focus strictly on whether the content in the final response is supported by the tool outputs.
- Do not reward fluent language or style; only check alignment.
- Provide a short explanation justifying the label.

Your output must contain only one of these labels:
aligned, partially_aligned, or misaligned.
`;
```

## View progress in Phoenix

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/align-evals-2.png" %}
