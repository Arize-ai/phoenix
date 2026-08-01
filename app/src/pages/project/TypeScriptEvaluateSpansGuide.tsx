import { ExternalLink, Heading, Text, View } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code";
import { PackageManagerCommandBlock } from "@phoenix/components/code/PackageManagerCommandBlock";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";

function getEvaluateSpansTypeScript({
  projectName,
  spanIds,
}: {
  projectName: string;
  spanIds: string[];
}) {
  const spanIdLines = spanIds.map((spanId) => `  "${spanId}",`).join("\n");
  return `import { openai } from "@ai-sdk/openai";
import { createClient } from "@arizeai/phoenix-client";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createClassifier } from "@arizeai/phoenix-evals/llm";

const client = createClient(); // uses PHOENIX_HOST and PHOENIX_API_KEY

// The spans you selected in the UI
const spanIds = [
${spanIdLines}
];

// Pull the selected spans from the project
const { spans } = await getSpans({
  client,
  project: { projectName: "${projectName}" },
  spanIds,
});

// Define an LLM-as-a-judge evaluator
const evaluator = await createClassifier({
  model: openai("gpt-4o-mini"),
  choices: { correct: 1, incorrect: 0 },
  promptTemplate: \`Given the input and output of an LLM application, label the output as correct or incorrect.
Input: {{input}}
Output: {{output}}\`,
});

// Score each span and log the results back as span annotations
const spanAnnotations = await Promise.all(
  spans.map(async (span) => {
    const attributes = (span.attributes ?? {}) as Record<
      string,
      { value?: unknown } | undefined
    >;
    const result = await evaluator({
      input: JSON.stringify(attributes["input"]?.value ?? ""),
      output: JSON.stringify(attributes["output"]?.value ?? ""),
    });
    return {
      spanId: span.context.span_id,
      name: "correctness",
      annotatorKind: "LLM" as const,
      label: result.label,
      score: result.score,
    };
  })
);

await logSpanAnnotations({ client, spanAnnotations });`;
}

export function TypeScriptEvaluateSpansGuide({
  projectName,
  spanIds,
}: {
  projectName: string;
  spanIds: string[];
}) {
  return (
    <div>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Install Dependencies
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Evals run in your environment using the Phoenix client and evals
          packages. The example below uses OpenAI via the AI SDK as the judge
          model, but any supported provider works.
        </Text>
      </View>
      <PackageManagerCommandBlock
        language="TypeScript"
        packages={[
          "@arizeai/phoenix-client",
          "@arizeai/phoenix-evals",
          "@ai-sdk/openai",
        ]}
      />
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Evaluate the Selected Spans
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          The snippet below pulls the spans you selected, scores each one with
          an LLM-as-a-judge evaluator, and logs the results back as span
          annotations. Scores appear on the spans and in the annotation score
          charts.
        </Text>
      </View>
      <CodeWrap>
        <TypeScriptBlockWithCopy
          value={getEvaluateSpansTypeScript({ projectName, spanIds })}
        />
      </CodeWrap>
      <View paddingBottom="size-100" paddingTop="size-100">
        <Text>
          For more ways to evaluate traces — including evaluating whole traces
          and running evals continuously — consult the{" "}
          <ExternalLink href="https://arize.com/docs/phoenix/tracing/how-to-tracing/feedback-and-annotations/evaluating-phoenix-traces">
            documentation
          </ExternalLink>
        </Text>
      </View>
    </div>
  );
}
