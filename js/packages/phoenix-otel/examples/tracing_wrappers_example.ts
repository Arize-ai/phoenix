// Demonstrates the OpenInference span-kind wrappers that @arizeai/phoenix-otel
// re-exports from @arizeai/openinference-core. Each wrapper preserves the exact
// type signature of the function it wraps, so the traced pipeline below stays
// fully type-checked end to end.
//
// This example wires the seven span-kind wrappers added in openinference-core
// 2.4.0 — traceEmbedding, traceRetriever, traceReranker, traceGuardrail,
// tracePrompt, traceLLM, and traceEvaluator — into a small RAG pipeline, with
// traceChain orchestrating the steps.

/* eslint-disable no-console */
import {
  type Document,
  type Embedding,
  type Message,
  type TokenCount,
  context,
  getEmbeddingAttributes,
  getLLMAttributes,
  getRetrieverAttributes,
  register,
  setSession,
  traceChain,
  traceEmbedding,
  traceEvaluator,
  traceGuardrail,
  traceLLM,
  tracePrompt,
  traceReranker,
  traceRetriever,
} from "../src";

interface RagResult {
  answer: string;
  documents: Document[];
  evaluation: { label: "correct" | "incorrect"; score: number };
}

async function main() {
  const provider = register({
    projectName: "tracing-wrappers-example",
    batch: false,
  });

  // traceEmbedding (EMBEDDING) — turn the query text into a vector. processOutput
  // records the model name and vector via the typed getEmbeddingAttributes builder.
  const embedQuery = traceEmbedding(
    async (query: string): Promise<Embedding> => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { text: query, vector: [0.12, 0.04, 0.91] };
    },
    {
      name: "embed-query",
      processOutput: (embedding) =>
        getEmbeddingAttributes({
          modelName: "text-embedding-3-small",
          embeddings: [embedding],
        }),
    }
  );

  // traceRetriever (RETRIEVER) — fetch candidate documents for the query vector.
  const retrieveDocuments = traceRetriever(
    async (_vector: number[]): Promise<Document[]> => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return [
        {
          id: "doc-1",
          content: "Phoenix is an open-source LLM observability platform.",
          score: 0.42,
        },
        {
          id: "doc-2",
          content: "Phoenix traces, evaluates, and monitors LLM applications.",
          score: 0.39,
        },
        {
          id: "doc-3",
          content: "An unrelated note about gardening.",
          score: 0.05,
        },
      ];
    },
    {
      name: "retrieve-documents",
      processOutput: (documents) => getRetrieverAttributes({ documents }),
    }
  );

  // traceReranker (RERANKER) — reorder retrieved documents by relevance and keep
  // the top results.
  const rerankDocuments = traceReranker(
    async (_query: string, documents: Document[]): Promise<Document[]> => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return [...documents]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 2);
    },
    { name: "rerank-documents" }
  );

  // traceGuardrail (GUARDRAIL) — screen the user input before it reaches the model.
  const moderateInput = traceGuardrail(
    async (text: string): Promise<{ flagged: boolean; reason?: string }> => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return /(password|ssn|api[_-]?key)/i.test(text)
        ? { flagged: true, reason: "possible sensitive data" }
        : { flagged: false };
    },
    { name: "moderate-input" }
  );

  // tracePrompt (PROMPT) — assemble the chat messages from the query and context.
  // A synchronous function is wrapped just as easily as an async one.
  const buildPrompt = tracePrompt(
    (query: string, documents: Document[]): Message[] => {
      const contextText = documents.map((doc) => doc.content ?? "").join("\n");
      return [
        { role: "system", content: "Answer using only the provided context." },
        {
          role: "user",
          content: `Context:\n${contextText}\n\nQuestion: ${query}`,
        },
      ];
    },
    { name: "build-prompt" }
  );

  // traceLLM (LLM) — call the model. processInput and processOutput use the typed
  // getLLMAttributes builder to capture messages and token usage.
  const generateAnswer = traceLLM(
    async (
      messages: Message[]
    ): Promise<{ message: Message; tokenCount: TokenCount }> => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      void messages;
      return {
        message: {
          role: "assistant",
          content:
            "Phoenix is an open-source platform for tracing and evaluating LLM applications.",
        },
        tokenCount: { prompt: 64, completion: 22, total: 86 },
      };
    },
    {
      name: "generate-answer",
      processInput: (messages) =>
        getLLMAttributes({
          provider: "openai",
          modelName: "gpt-4o-mini",
          inputMessages: messages,
        }),
      processOutput: (result) =>
        getLLMAttributes({
          provider: "openai",
          modelName: "gpt-4o-mini",
          outputMessages: [result.message],
          tokenCount: result.tokenCount,
        }),
    }
  );

  // traceEvaluator (EVALUATOR) — score the answer, e.g. an LLM-as-a-judge check.
  const evaluateAnswer = traceEvaluator(
    async (
      _question: string,
      answer: string
    ): Promise<{ label: "correct" | "incorrect"; score: number }> => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      const score = answer.toLowerCase().includes("phoenix") ? 1 : 0;
      return { label: score === 1 ? "correct" : "incorrect", score };
    },
    { name: "evaluate-answer" }
  );

  // traceChain (CHAIN) — orchestrate the steps. The return type flows through the
  // wrapper unchanged, so `askPhoenix` is typed as `(question: string) => Promise<RagResult>`.
  const askPhoenix = traceChain(
    async (question: string): Promise<RagResult> => {
      const guard = await moderateInput(question);
      if (guard.flagged) {
        throw new Error(`Input rejected: ${guard.reason ?? "guardrail"}`);
      }

      const { vector = [] } = await embedQuery(question);
      const candidates = await retrieveDocuments(vector);
      const documents = await rerankDocuments(question, candidates);
      const messages = buildPrompt(question, documents);
      const { message } = await generateAnswer(messages);
      const answer = message.content ?? "";
      const evaluation = await evaluateAnswer(question, answer);

      return { answer, documents, evaluation };
    },
    { name: "ask-phoenix" }
  );

  // Propagate a session id so every span in the pipeline is grouped together.
  const result = await context.with(
    setSession(context.active(), { sessionId: "session-rag-001" }),
    () => askPhoenix("What is Phoenix?")
  );

  console.log(`answer: ${result.answer}`);
  console.log(
    `evaluation: ${result.evaluation.label} (${result.evaluation.score})`
  );

  await provider.shutdown();
}

main().catch(console.error);
