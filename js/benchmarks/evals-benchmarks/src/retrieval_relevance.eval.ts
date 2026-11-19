/** Retrieval relevance benchmark: retrieved information judged relevant/irrelevant to the request.
 *
 * Source-agnostic — the examples mirror every retrieval trace shape (RAG documents,
 * knowledge-base / web-search / MCP / SQL tool outputs, and information embedded in an
 * LLM turn), plus the negatives a relevance eval must catch: wrong entity/time, empty or
 * errored results, action-tool status output, and tangential-but-unhelpful content.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { createRetrievalRelevanceEvaluator } from "@arizeai/phoenix-evals";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

const labels = createLabelAccumulator();
const evaluator = createRetrievalRelevanceEvaluator({ model: evalModel });

type RetrievalRelevanceLabel = "relevant" | "irrelevant";
type Example = {
  input: string;
  context: string;
  expectedLabel: RetrievalRelevanceLabel;
};

const examplesByCategory: Record<string, Example[]> = {
  rag: [
    {
      input: "How do I set a data retention policy on traces in Phoenix?",
      context:
        "Data retention in Phoenix is controlled per-project. Go to Settings > Data Retention and choose a policy, e.g. delete traces older than 30 days.\n\nTrace retention can also be set with the PHOENIX_TRACE_RETENTION environment variable.",
      expectedLabel: "relevant",
    },
    {
      input: "What is machine learning?",
      context:
        "Machine learning is a subset of artificial intelligence in which models learn patterns from data rather than being explicitly programmed.",
      expectedLabel: "relevant",
    },
    {
      input: "How do I export spans from Phoenix to a dataframe?",
      context:
        "Call client.spans.get_spans_dataframe(project_identifier=...) to pull spans into a pandas DataFrame.\n\nAttributes come back as flattened columns prefixed with 'attributes.'.",
      expectedLabel: "relevant",
    },
    {
      input: "How do I rotate my Phoenix API key?",
      context:
        "Phoenix supports embeddings visualization with UMAP projections for drift analysis across inference stores.\n\nThe evals module ships several built-in LLM-as-a-judge metrics.",
      expectedLabel: "irrelevant",
    },
    {
      input: "What is the boiling point of water at sea level?",
      context:
        "The French Revolution began in 1789 and led to the rise of Napoleon Bonaparte.",
      expectedLabel: "irrelevant",
    },
  ],
  rag_partial: [
    {
      input:
        "What auth methods does Phoenix support for the collector endpoint?",
      context:
        "Bearer tokens are accepted on the OTLP collector endpoint.\n\nThe UMAP projection view helps analyze embedding drift.\n\nRecipes for chunking documents are covered in the ingestion guide.",
      expectedLabel: "relevant",
    },
    {
      input: "How much does Phoenix cost?",
      context:
        "Some unrelated notes about dashboard theming and keyboard shortcuts.\n\nSelf-hosted Phoenix is free and open source; the Arize AX cloud tier bills on ingested spans.",
      expectedLabel: "relevant",
    },
  ],
  tool_kb: [
    {
      input: "What Python versions does the phoenix client support?",
      context:
        '{"supported_python": ["3.9", "3.10", "3.11", "3.12", "3.13"], "notes": "3.8 reached end of life"}',
      expectedLabel: "relevant",
    },
    {
      input: "What database backends does Phoenix support?",
      context:
        '{"backends": ["SQLite (default)", "PostgreSQL"], "note": "Set PHOENIX_SQL_DATABASE_URL to use Postgres."}',
      expectedLabel: "relevant",
    },
    {
      input: "Does Phoenix bill per span or per trace?",
      context:
        "Getting started: install arize-phoenix with pip and call px.launch_app() to open the UI locally.",
      expectedLabel: "irrelevant",
    },
  ],
  web_search: [
    {
      input: "What's the latest stable Python version?",
      context:
        "Python 3.14 Released: Python 3.14.0 is the newest major stable release, available now.\nPython Developer's Guide: 3.14 is the current stable branch.",
      expectedLabel: "relevant",
    },
    {
      input: "Who won the 2022 FIFA World Cup?",
      context:
        "Argentina won the 2022 FIFA World Cup, defeating France on penalties in the final in Qatar.",
      expectedLabel: "relevant",
    },
    {
      input: "What's the latest stable Python version?",
      context:
        "10 tips for writing faster Python loops.\nA history of the Python programming language's name and logo.",
      expectedLabel: "irrelevant",
    },
    {
      input: "What is the current release version of arize-phoenix?",
      context:
        "A 2021 blog post announcing the very first public preview of Phoenix and its original feature set.",
      expectedLabel: "irrelevant",
    },
  ],
  mcp_docs: [
    {
      input:
        "Using the Phoenix docs, how do I create a dataset from a dataframe?",
      context:
        "Use px.Client().upload_dataset(dataframe=df, input_keys=[...], output_keys=[...], dataset_name='my-dataset') to create a dataset from a pandas DataFrame.",
      expectedLabel: "relevant",
    },
    {
      input: "How do I run an experiment over a dataset in Phoenix?",
      context:
        "Call px.Client().run_experiment(dataset=ds, task=my_task, evaluators=[...]) to run an experiment; results appear under the Experiments tab.",
      expectedLabel: "relevant",
    },
    {
      input:
        "Using the Phoenix docs, how do I create a dataset from a dataframe?",
      context:
        "Datasets are versioned; each upload creates a new immutable version. Older content is not covered here.",
      expectedLabel: "irrelevant",
    },
    {
      input: "Using the Phoenix docs, how do I add annotations to a span?",
      context:
        "The tracing quickstart shows how to install the OpenTelemetry SDK and point the collector endpoint at a local Phoenix instance.",
      expectedLabel: "irrelevant",
    },
  ],
  sql: [
    {
      input: "How many orders did customer 4471 place last month?",
      context: '[{"n": 7, "revenue": 842.15}]',
      expectedLabel: "relevant",
    },
    {
      input: "What is the total revenue from customer 4471 last month?",
      context: '[{"total_revenue": 842.15, "currency": "USD"}]',
      expectedLabel: "relevant",
    },
    {
      input: "How many orders did customer 4471 place last month?",
      context: "[]",
      expectedLabel: "irrelevant",
    },
    {
      input: "What is the average order value for customer 4471?",
      context:
        '[{"product_name": "Widget", "in_stock": true, "warehouse": "NJ"}]',
      expectedLabel: "irrelevant",
    },
  ],
  embedded: [
    {
      input: "What did Arize announce at their last conference?",
      context:
        "[web_search_result] Arize Observe 2025 keynote: launched the Alyx AI copilot and expanded eval library. (source: arize.com)",
      expectedLabel: "relevant",
    },
    {
      input: "What did Arize announce at their last conference?",
      context:
        "[web_search_result] A recipe blog's guide to making sourdough bread at home over a weekend. (source: example.com)",
      expectedLabel: "irrelevant",
    },
  ],
  wrong_entity: [
    {
      input: "What is the population of Tokyo?",
      context:
        "Tokyo is the capital of Japan with a metropolitan population of roughly 37 million people.",
      expectedLabel: "relevant",
    },
    {
      input: "What is the capital of Australia?",
      context: "Vienna is the capital and largest city of Austria.",
      expectedLabel: "irrelevant",
    },
    {
      input: "What were the 2024 Q4 earnings for Acme Corp?",
      context: "Acme Corp's 2019 Q1 earnings were $2.1M, up 4% year over year.",
      expectedLabel: "irrelevant",
    },
  ],
  empty_error: [
    {
      input: "What is the refund policy for enterprise plans?",
      context: "",
      expectedLabel: "irrelevant",
    },
    {
      input: "What is the refund policy for enterprise plans?",
      context: '{"error": "search backend timed out", "results": []}',
      expectedLabel: "irrelevant",
    },
  ],
  action_output: [
    {
      input: "What is the status of my last three support tickets?",
      context: '{"status": "sent", "message_id": "msg_9931"}',
      expectedLabel: "irrelevant",
    },
    {
      input: "Summarize the key risks in the attached contract.",
      context: '{"status": "email_sent", "recipient": "manager@corp.com"}',
      expectedLabel: "irrelevant",
    },
  ],
  tangential: [
    {
      input: "How do I configure OAuth2 SSO login for the Phoenix UI?",
      context:
        "To enable OAuth2/OIDC SSO, set PHOENIX_OAUTH2_CLIENT_ID and PHOENIX_OAUTH2_CLIENT_SECRET and configure the identity provider's redirect URL.",
      expectedLabel: "relevant",
    },
    {
      input: "How do I configure OAuth2 SSO login for the Phoenix UI?",
      context:
        "Phoenix supports API-key authentication via the PHOENIX_API_KEY header for programmatic access to the REST API.",
      expectedLabel: "irrelevant",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, examples]) =>
    examples.map((example) => ({
      input: {
        input: example.input,
        context: example.context,
      },
      expected: { label: example.expectedLabel },
      metadata: { category },
      splits: [category, example.expectedLabel],
    }))
);

px.describe(
  "retrieval-relevance-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}] ${row.input.input.slice(0, 60)}`,
      async ({ input, expected }) => {
        const result = await evaluator.evaluate(input);
        px.logOutput(result);
        px.logAnnotation({
          name: "retrieval_relevance",
          label: result.label,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        recordPrediction({
          labels,
          truth: expected?.label,
          predicted: result.label,
        });
        await px.evaluate(accuracy);
      }
    );
    registerAggregateMetricsTest(labels);
  },
  {
    description:
      "Source-agnostic retrieval relevance across RAG documents, knowledge-base / web-search / MCP / SQL tool outputs, and information embedded in an LLM turn, plus negatives: wrong entity or time period, empty or errored results, action-tool status output, and tangential-but-unhelpful content.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);
