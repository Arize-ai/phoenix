import type { Example } from "@arizeai/phoenix-client/types/datasets";

export const phoenixTopicExamples: Example[] = [
  // On-topic: Phoenix OSS observability questions (10)
  {
    input: {
      prompt: "How do I instrument my LangChain app with Phoenix to see traces?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "LangChain instrumentation with Phoenix",
    },
  },
  {
    input: {
      prompt:
        "I'm getting high latency in my RAG pipeline. How can I use Phoenix to identify which step is slow?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "RAG latency debugging with Phoenix traces",
    },
  },
  {
    input: {
      prompt:
        "What's the difference between a span and a trace in the context of Phoenix?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "Phoenix concepts: spans vs traces",
    },
  },
  {
    input: {
      prompt:
        "How do I add custom attributes to a span when using Phoenix's OpenTelemetry instrumentation?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "Custom span attributes with Phoenix OTel",
    },
  },
  {
    input: {
      prompt:
        "I want to run evaluations on my RAG responses using Phoenix. Where do I start?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "Getting started with Phoenix RAG evaluations",
    },
  },
  {
    input: {
      prompt:
        "How do I set up Phoenix to trace my FastAPI server that calls GPT-4?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "FastAPI + GPT-4 tracing with Phoenix",
    },
  },
  {
    input: {
      prompt:
        "What OpenInference semantic conventions should I use for embedding calls?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "OpenInference conventions for embeddings",
    },
  },
  {
    input: {
      prompt:
        "How do I use Phoenix's dataset feature to create a golden test set?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "Creating golden test sets in Phoenix datasets",
    },
  },
  {
    input: {
      prompt:
        "I deployed Phoenix to production but my traces aren't showing up. What should I check?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "Troubleshooting missing traces in production",
    },
  },
  {
    input: {
      prompt:
        "Can I use Phoenix to compare different prompt versions against each other?",
    },
    metadata: {
      category: "on_topic",
      expectedOnTopic: true,
      description: "Prompt comparison using Phoenix experiments",
    },
  },

  // Off-topic: Elixir Phoenix web framework (5)
  {
    input: {
      prompt:
        "I'm getting a NoRouteError in Phoenix for a path I've definitely defined in my router. How do I debug this?",
    },
    metadata: {
      category: "off_topic_elixir_phoenix",
      expectedOnTopic: false,
      description: "Elixir Phoenix router debugging",
    },
  },
  {
    input: {
      prompt:
        "How do I handle file uploads in Phoenix LiveView? I need to show a progress indicator.",
    },
    metadata: {
      category: "off_topic_elixir_phoenix",
      expectedOnTopic: false,
      description: "Phoenix LiveView file uploads",
    },
  },
  {
    input: {
      prompt:
        "I want to set up real-time presence tracking with Phoenix Channels and PubSub.",
    },
    metadata: {
      category: "off_topic_elixir_phoenix",
      expectedOnTopic: false,
      description: "Phoenix Channels and PubSub presence tracking",
    },
  },
  {
    input: {
      prompt:
        "My Phoenix app is throwing a 'socket was closed' error in production. Could this be related to my LiveView configuration?",
    },
    metadata: {
      category: "off_topic_elixir_phoenix",
      expectedOnTopic: false,
      description: "Elixir Phoenix LiveView socket error",
    },
  },
  {
    input: {
      prompt: "How do I write Ecto migrations for a new Phoenix project?",
    },
    metadata: {
      category: "off_topic_elixir_phoenix",
      expectedOnTopic: false,
      description: "Ecto migrations in Elixir Phoenix",
    },
  },

  // Off-topic: Arize AX enterprise platform (5)
  {
    input: {
      prompt:
        "I want production model monitoring with drift alerts - is this in Phoenix OSS or do I need Arize AX?",
    },
    metadata: {
      category: "off_topic_arize_ax",
      expectedOnTopic: false,
      description: "Comparing Phoenix OSS vs Arize AX for drift monitoring",
    },
  },
  {
    input: {
      prompt:
        "How do I connect my Kubernetes deployment to Arize for continuous monitoring?",
    },
    metadata: {
      category: "off_topic_arize_ax",
      expectedOnTopic: false,
      description: "Arize AX Kubernetes integration",
    },
  },
  {
    input: {
      prompt:
        "What's the process for onboarding to Arize AX? Our team needs enterprise support.",
    },
    metadata: {
      category: "off_topic_arize_ax",
      expectedOnTopic: false,
      description: "Arize AX enterprise onboarding",
    },
  },
  {
    input: {
      prompt:
        "I'm looking at Arize's embedding visualization feature - is that only in the paid version?",
    },
    metadata: {
      category: "off_topic_arize_ax",
      expectedOnTopic: false,
      description: "Arize AX embedding visualization pricing",
    },
  },
  {
    input: {
      prompt:
        "I saw that Arize offers a hosted version of Phoenix - how is that different from self-hosting?",
    },
    metadata: {
      category: "off_topic_arize_ax",
      expectedOnTopic: false,
      description: "Arize hosted Phoenix vs self-hosted comparison",
    },
  },

  // Off-topic: Apache Phoenix (HBase SQL) (3)
  {
    input: {
      prompt:
        "How do I create a secondary index in Apache Phoenix for better query performance?",
    },
    metadata: {
      category: "off_topic_apache_phoenix",
      expectedOnTopic: false,
      description: "Apache Phoenix secondary index creation",
    },
  },
  {
    input: {
      prompt:
        "I'm getting a SQLTimeoutException when querying Phoenix - is this a connection pool issue?",
    },
    metadata: {
      category: "off_topic_apache_phoenix",
      expectedOnTopic: false,
      description: "Apache Phoenix SQLTimeoutException debugging",
    },
  },
  {
    input: {
      prompt:
        "How do I map an existing HBase table to an Apache Phoenix schema?",
    },
    metadata: {
      category: "off_topic_apache_phoenix",
      expectedOnTopic: false,
      description: "Mapping HBase tables to Apache Phoenix schema",
    },
  },

  // Off-topic: Adjacent AI/LLM dev questions (7)
  {
    input: {
      prompt:
        "How do I set up webhooks so my CI pipeline gets notified when evaluation scores drop below a threshold?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "CI webhook for evaluation score alerts",
    },
  },
  {
    input: {
      prompt:
        "I want to add Pinecone as a vector store to my LangChain RAG app — what's the best way to set that up?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "Pinecone vector store with LangChain",
    },
  },
  {
    input: {
      prompt:
        "How do I add streaming support to my FastAPI endpoint that calls GPT-4o?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "FastAPI streaming with GPT-4o",
    },
  },
  {
    input: {
      prompt:
        "What's the best way to implement rate limiting for my LLM API to avoid hitting OpenAI token quotas?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "LLM API rate limiting for OpenAI",
    },
  },
  {
    input: {
      prompt:
        "I'm using LangGraph for my agentic workflow — how do I structure the state graph for a multi-agent system?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "LangGraph multi-agent state graph structure",
    },
  },
  {
    input: {
      prompt:
        "How do I set up Redis caching for embeddings to reduce OpenAI API costs?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "Redis caching for embeddings",
    },
  },
  {
    input: {
      prompt:
        "What's the difference between Chroma and Pinecone for vector storage in a production RAG system?",
    },
    metadata: {
      category: "off_topic_adjacent",
      expectedOnTopic: false,
      description: "Chroma vs Pinecone vector store comparison",
    },
  },

  // Off-topic: Other (2)
  {
    input: {
      prompt:
        "Does Phoenix support model fine-tuning? I want to improve my model's performance on specific tasks.",
    },
    metadata: {
      category: "off_topic_other",
      expectedOnTopic: false,
      description: "Model fine-tuning confusion with Phoenix",
    },
  },
  {
    input: {
      prompt:
        "How do I monitor my Phoenix app's performance in production?",
    },
    metadata: {
      category: "off_topic_other",
      expectedOnTopic: false,
      description: "Ambiguous — could be Elixir Phoenix or AI Phoenix",
    },
  },
];

export const phoenixTopicDataset = {
  name: "cli-agent-phoenix-topic",
  description:
    "Mixed on-topic and off-topic questions to seed Phoenix traces with realistic inputs",
  examples: phoenixTopicExamples.map((example) => ({
    ...example,
    splits: example.metadata?.category
      ? [example.metadata.category as string]
      : [],
  })),
};
