import { ExternalLink, Heading, Text, View } from "@phoenix/components";
import {
  CodeWrap,
  PackageManagerCommandBlock,
  PythonBlockWithCopy,
} from "@phoenix/components/code";

function getEvaluateSpansPython({
  projectName,
  spanIds,
}: {
  projectName: string;
  spanIds: string[];
}) {
  const spanIdLines = spanIds.map((spanId) => `    "${spanId}",`).join("\n");
  return `from phoenix.client import Client
from phoenix.evals import LLM, create_classifier, evaluate_dataframe
from phoenix.evals.utils import to_annotation_dataframe

client = Client()  # uses PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY

# The spans you selected in the UI
span_ids = [
${spanIdLines}
]

# Pull the selected spans from the project
spans_df = client.spans.get_spans_dataframe(
    project_identifier="${projectName}",
)
spans_df = spans_df.loc[spans_df.index.intersection(span_ids)]
spans_df = spans_df.rename(
    columns={
        "attributes.input.value": "input",
        "attributes.output.value": "output",
    }
)

# Define an LLM-as-a-judge evaluator
llm = LLM(provider="openai", model="gpt-4o-mini")
correctness = create_classifier(
    name="correctness",
    llm=llm,
    prompt_template=(
        "Given the input and output of an LLM application, "
        "label the output as correct or incorrect.\\n"
        "Input: {input}\\n"
        "Output: {output}"
    ),
    choices={"correct": 1.0, "incorrect": 0.0},
)

# Run the evaluator and log the scores back as span annotations
results_df = evaluate_dataframe(spans_df, [correctness])
client.spans.log_span_annotations_dataframe(
    dataframe=to_annotation_dataframe(results_df),
)`;
}

export function PythonEvaluateSpansGuide({
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
          packages. The example below uses OpenAI as the judge model, but any
          supported provider works.
        </Text>
      </View>
      <PackageManagerCommandBlock
        language="Python"
        packages={["arize-phoenix-client", "arize-phoenix-evals", "openai"]}
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
        <PythonBlockWithCopy
          value={getEvaluateSpansPython({ projectName, spanIds })}
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
