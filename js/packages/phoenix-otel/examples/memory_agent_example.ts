// End-to-end agent example: recall from memory, answer, then store a new fact.
// Shows how `memory.query` and `memory.store` spans nest under an AGENT span
// alongside a RETRIEVER span for document context.
//
// Run from js/ after building phoenix-otel:
//   pnpm --filter phoenix-otel build
//   npx tsx packages/phoenix-otel/examples/memory_agent_example.ts

/* eslint-disable no-console */
import {
  OpenInferenceSpanKind,
  context,
  getMetadataAttributes,
  getRetrieverAttributes,
  register,
  setSession,
  traceAgent,
  traceChain,
  traceRetriever,
  withSpan,
} from "../src";

interface MemoryEntry {
  id: string;
  content: string;
}

const LONG_TERM_MEMORY: MemoryEntry[] = [
  { id: "mem-1", content: "User prefers concise answers with bullet points." },
];

const KNOWLEDGE_BASE = [
  { id: "doc-1", content: "Phoenix traces LLM applications with OpenInference." },
  { id: "doc-2", content: "Phoenix supports sessions, projects, and evaluations." },
];

async function main() {
  const provider = register({
    projectName: "memory-agent-example",
    batch: false,
  });

  const queryMemory = withSpan(
    async (query: string): Promise<{ hit: boolean; entries: MemoryEntry[] }> => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const entries = LONG_TERM_MEMORY.filter((entry) =>
        entry.content.toLowerCase().includes(query.toLowerCase())
      );
      return { hit: entries.length > 0, entries };
    },
    {
      name: "memory.query",
      kind: OpenInferenceSpanKind.CHAIN,
      processOutput: (result: { hit: boolean; entries: MemoryEntry[] }) =>
        getMetadataAttributes({
          operation: "memory.query",
          "memory.hit": result.hit,
          "memory.result_count": result.entries.length,
        }),
    }
  );

  const retrieveDocs = traceRetriever(
    async (query: string) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return KNOWLEDGE_BASE.filter((doc) =>
        doc.content.toLowerCase().includes(query.toLowerCase())
      ).map((doc) => ({ id: doc.id, content: doc.content, score: 0.9 }));
    },
    {
      name: "retrieve-docs",
      processOutput: (documents: { id: string; content: string; score: number }[]) =>
        getRetrieverAttributes({ documents }),
    }
  );

  const storeMemory = withSpan(
    async (content: string): Promise<{ entryId: string }> => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      const entryId = `mem-${Date.now()}`;
      LONG_TERM_MEMORY.push({ id: entryId, content });
      return { entryId };
    },
    {
      name: "memory.store",
      kind: OpenInferenceSpanKind.CHAIN,
      processOutput: (result: { entryId: string }) =>
        getMetadataAttributes({
          operation: "memory.store",
          "memory.entry_id": result.entryId,
        }),
    }
  );

  const answerWithContext = traceChain(
    async (question: string, memory: MemoryEntry[], docs: { content?: string }[]) => {
      const memoryHint = memory.map((m) => m.content).join("; ");
      const docHint = docs.map((d) => d.content ?? "").join("; ");
      return `Answer for "${question}" using memory=[${memoryHint}] and docs=[${docHint}]`;
    },
    { name: "compose-answer" }
  );

  const supportAgent = traceAgent(
    async (question: string) => {
      const recall = await queryMemory("concise");
      const docs = await retrieveDocs("Phoenix");
      const answer = await answerWithContext(question, recall.entries, docs);
      await storeMemory(`Last question: ${question}`);
      return answer;
    },
    { name: "support-agent" }
  );

  const answer = await context.with(
    setSession(context.active(), { sessionId: "session-agent-001" }),
    () => supportAgent("How does Phoenix help with tracing?")
  );

  console.log(answer);

  await provider.shutdown();
}

main().catch(console.error);