// Install alongside @arizeai/phoenix-otel before running:
// npm install @arizeai/openinference-core @arizeai/openinference-semantic-conventions

/* eslint-disable no-console */
import { setSession, setMetadata, withSpan } from "@arizeai/openinference-core";
import { OpenInferenceSpanKind } from "@arizeai/openinference-semantic-conventions";
import { context } from "@opentelemetry/api";

import { register } from "../src";

async function main() {
  const provider = register({
    projectName: "manual-spans-example",
    batch: false,
  });

  // withSpan wraps any function with an OpenInference-typed span
  const retrieveDocuments = withSpan(
    async (_query: string) => {
      // simulate retrieval latency
      await new Promise((resolve) => setTimeout(resolve, 100));
      return [
        { id: "doc-1", content: "Phoenix is an AI observability platform." },
        { id: "doc-2", content: "It supports tracing LLM applications." },
      ];
    },
    { name: "retrieve-documents", kind: OpenInferenceSpanKind.RETRIEVER }
  );

  const generateAnswer = withSpan(
    async (question: string, docs: { id: string; content: string }[]) => {
      const ctx = docs.map((d) => d.content).join("\n");
      // simulate LLM latency
      await new Promise((resolve) => setTimeout(resolve, 200));
      return `Based on the context:\n${ctx}\n\nAnswer: Phoenix traces your LLM calls.`;
    },
    { name: "generate-answer", kind: OpenInferenceSpanKind.LLM }
  );

  // Chain the steps together under a parent span, with session tracking
  const ragPipeline = withSpan(
    async (question: string) => {
      const docs = await retrieveDocuments(question);
      const answer = await generateAnswer(question, docs);
      return answer;
    },
    { name: "rag-pipeline", kind: OpenInferenceSpanKind.CHAIN }
  );

  // Propagate session and metadata via context so all child spans inherit them
  const answer = await context.with(
    setMetadata(
      setSession(context.active(), { sessionId: "session-abc-123" }),
      { environment: "development" }
    ),
    () => ragPipeline("What is Phoenix?")
  );

  console.log(answer);

  await provider.shutdown();
}

main().catch(console.error);
