export const DATASET_LABELS = [
  { id: "golden", color: "#3B82F6" },
  { id: "regression", color: "#EF4444" },
  { id: "edge-case", color: "#F59E0B" },
];

export const SPLITS = [
  { id: "train", name: "train" },
  { id: "validation", name: "validation" },
  { id: "test", name: "test" },
  { id: "holdout", name: "holdout" },
];

export const LABELS = [
  "golden",
  "regression",
  "edge-case",
  "hallucination",
  "needs-review",
  "production",
  "customer-support",
  "retrieval",
  "tool-calling",
  "multi-turn",
  "refusal",
  "jailbreak-attempt",
  "summarization",
  "translation",
  "code-generation",
  "long-context",
  "low-latency",
  "high-cost",
  "pii",
  "toxicity",
  "sql",
  "math",
  "classification",
  "extraction",
  "agentic",
].map((name) => ({ id: name, name }));

export const MANY_PROJECTS = Array.from({ length: 250 }, (_, index) => ({
  id: `project-${index + 1}`,
  name: `agent-eval-${String(index + 1).padStart(3, "0")}`,
}));

export const LONG_PROMPT_NAMES = [
  { id: "short", name: "qa-grader" },
  {
    id: "long",
    name: "customer-support-escalation-classifier-with-retrieval-context-v12",
  },
  {
    id: "sentence",
    name: "Summarize the retrieved documents for the support agent and cite each source you use",
  },
];
