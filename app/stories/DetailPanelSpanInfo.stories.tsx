import type { Meta, StoryObj } from "@storybook/react";

import { SpanInfo } from "@phoenix/pages/trace/SpanDetails";

import {
  createSpanInfoFixture,
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const llmSpan = createSpanInfoFixture({
  spanKind: "llm",
  input: { mimeType: "text", value: "Summarize the incident report." },
  output: {
    mimeType: "text",
    value:
      "The deployment recovered after the database connection pool was resized.",
  },
  attributes: JSON.stringify({
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      invocation_parameters: JSON.stringify({
        temperature: 0.2,
        top_p: 0.95,
        max_completion_tokens: 4096,
        frequency_penalty: 0.1,
        presence_penalty: 0,
        parallel_tool_calls: true,
        tool_choice: "auto",
        reasoning: { effort: "medium", summary: "auto" },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "incident_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["sev0", "sev1", "sev2"] },
                summary: { type: "string", maxLength: 2000 },
                affectedServices: {
                  type: "array",
                  items: { type: "string" },
                },
                remediationSteps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      owner: { type: "string" },
                      action: { type: "string" },
                      deadline: { type: "string", format: "date-time" },
                    },
                    required: ["owner", "action"],
                  },
                },
              },
              required: ["severity", "summary", "affectedServices"],
              additionalProperties: false,
            },
          },
        },
        service_tier: "priority",
        seed: 742_991,
        stop: ["<END_INCIDENT>", "<ESCALATE>"],
        metadata: {
          environment: "production",
          workflow: "incident-triage",
          tenant: "enterprise-1042",
          requestId: "req_01J3J8N6T7CX9QV2F5B4K1M0PZ",
        },
      }),
    },
    metadata: { environment: "production", region: "us-west-2" },
  }),
});

const longInvocationParametersSpan = createSpanInfoFixture({
  spanKind: "llm",
  input: {
    mimeType: "text",
    value:
      "Investigate the production incident and propose a remediation plan.",
  },
  output: {
    mimeType: "text",
    value:
      "The rollout exhausted the database connection pool. Roll back the deployment and resize the pool before retrying.",
  },
  attributes: JSON.stringify({
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      invocation_parameters: JSON.stringify({
        temperature: 0.2,
        max_completion_tokens: 16_384,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "production_incident_report",
            strict: true,
            schema: {
              type: "object",
              properties: Object.fromEntries(
                Array.from({ length: 80 }, (_unused, propertyIndex) => [
                  `diagnostic_signal_${String(propertyIndex + 1).padStart(3, "0")}`,
                  {
                    type: "string",
                    description:
                      "A detailed observation with supporting evidence, ownership, remediation guidance, and relevant operational caveats.",
                  },
                ])
              ),
              required: Array.from(
                { length: 80 },
                (_unused, propertyIndex) =>
                  `diagnostic_signal_${String(propertyIndex + 1).padStart(3, "0")}`
              ),
              additionalProperties: false,
            },
          },
        },
      }),
    },
  }),
});

const retrieverSpan = createSpanInfoFixture({
  spanKind: "retriever",
  input: { mimeType: "text", value: "How do I rotate an API key?" },
  attributes: JSON.stringify({
    retrieval: {
      documents: [
        {
          document: {
            id: "security-guide",
            content:
              "Create a replacement key, update consumers, then revoke the old key.",
            score: 0.94,
            metadata: { section: "Credentials" },
          },
        },
      ],
    },
  }),
  documentRetrievalMetrics: [
    { evaluationName: "relevance", hit: 1, ndcg: 0.92, precision: 1 },
  ],
});

const rerankerSpan = createSpanInfoFixture({
  spanKind: "reranker",
  attributes: JSON.stringify({
    reranker: {
      query: "Phoenix tracing setup",
      input_documents: [
        { document: { id: "doc-a", content: "Install the tracing package." } },
        { document: { id: "doc-b", content: "Configure an OTLP endpoint." } },
      ],
      output_documents: [
        {
          document: {
            id: "doc-b",
            content: "Configure an OTLP endpoint.",
            score: 0.98,
          },
        },
      ],
    },
  }),
});

const embeddingSpan = createSpanInfoFixture({
  spanKind: "embedding",
  attributes: JSON.stringify({
    embedding: {
      model_name: "text-embedding-3-small",
      embeddings: [
        { embedding: { text: "A compact semantic representation." } },
        { embedding: { text: "A second document chunk." } },
      ],
    },
  }),
});

const toolSpan = createSpanInfoFixture({
  spanKind: "tool",
  input: {
    mimeType: "json",
    value: JSON.stringify({ city: "Seattle" }, null, 2),
  },
  output: {
    mimeType: "json",
    value: JSON.stringify({ temperature: 68 }, null, 2),
  },
  attributes: JSON.stringify({
    tool: {
      name: "get_weather",
      description: "Returns the current temperature for a city.",
      parameters: { type: "object", required: ["city"] },
    },
  }),
});

const PRODUCTION_TOOLS = [
  {
    name: "query_metrics",
    description:
      "Queries production time-series metrics across services and regions.",
    properties: {
      expression: { type: "string" },
      startTime: { type: "string", format: "date-time" },
      endTime: { type: "string", format: "date-time" },
      stepSeconds: { type: "integer", minimum: 1 },
      filters: {
        type: "object",
        properties: {
          services: { type: "array", items: { type: "string" } },
          regions: { type: "array", items: { type: "string" } },
          environments: { type: "array", items: { type: "string" } },
          excludeSyntheticTraffic: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
    required: ["expression", "startTime", "endTime"],
  },
  {
    name: "search_logs",
    description: "Searches structured logs with tenant and deployment scoping.",
    properties: {
      query: { type: "string" },
      services: { type: "array", items: { type: "string" } },
      limit: { type: "integer", maximum: 10_000 },
    },
    required: ["query", "services"],
  },
  {
    name: "search_traces",
    description: "Finds matching traces.",
    properties: {
      condition: { type: "string" },
    },
    required: ["condition"],
  },
  {
    name: "get_deployment_status",
    description: "Returns rollout state, replica health, and image versions.",
    properties: {
      service: { type: "string" },
      environment: { type: "string", enum: ["staging", "production"] },
      region: { type: "string" },
    },
    required: ["service", "environment"],
  },
  {
    name: "get_feature_flags",
    description: "Lists feature flags.",
    properties: {
      tenantId: { type: "string" },
    },
    required: ["tenantId"],
  },
  {
    name: "get_recent_changes",
    description:
      "Collects deploys, config changes, migrations, and flag updates.",
    properties: {
      services: { type: "array", items: { type: "string" } },
      since: { type: "string", format: "date-time" },
    },
    required: ["services", "since"],
  },
  {
    name: "query_read_replica",
    description:
      "Runs a read-only diagnostic query against an isolated replica.",
    properties: {
      database: { type: "string" },
      sql: { type: "string" },
      statementTimeoutMs: { type: "integer", maximum: 30_000 },
      executionPolicy: {
        type: "object",
        properties: {
          regions: { type: "array", items: { type: "string" } },
          retry: {
            type: "object",
            properties: {
              attempts: { type: "integer", minimum: 1, maximum: 3 },
              backoff: {
                type: "string",
                enum: ["none", "linear", "exponential"],
              },
            },
            required: ["attempts", "backoff"],
          },
          auditReason: { type: "string", maxLength: 4000 },
        },
        required: ["regions", "auditReason"],
        additionalProperties: false,
      },
    },
    required: ["database", "sql"],
  },
  {
    name: "fetch_runbook",
    description: "Gets a runbook.",
    properties: {
      service: { type: "string" },
    },
    required: ["service"],
  },
  {
    name: "create_incident_timeline",
    description: "Appends a structured event to the active incident timeline.",
    properties: {
      incidentId: { type: "string" },
      occurredAt: { type: "string", format: "date-time" },
      summary: { type: "string", maxLength: 4000 },
      evidenceLinks: {
        type: "array",
        items: { type: "string", format: "uri" },
      },
    },
    required: ["incidentId", "occurredAt", "summary"],
  },
  {
    name: "page_on_call",
    description:
      "Pages the owning team through the incident-management system.",
    properties: {
      team: { type: "string" },
      severity: { type: "string", enum: ["sev0", "sev1", "sev2"] },
      message: { type: "string", maxLength: 2000 },
    },
    required: ["team", "severity", "message"],
  },
] as const;

const PRODUCTION_TOOL_CALLS = [
  {
    name: "query_metrics",
    arguments: {
      expression:
        "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
      startTime: "2026-07-23T15:00:00Z",
      endTime: "2026-07-23T16:00:00Z",
      stepSeconds: 30,
    },
    result: { series: 48, peakP99Ms: 12_842, baselineP99Ms: 730 },
  },
  {
    name: "search_logs",
    arguments: {
      query: "level:error AND error.type:DatabaseConnectionError",
      services: ["orchestrator", "model-runtime"],
      limit: 5000,
    },
    result: {
      matches: 2831,
      sampled: 200,
      dominantError: "connection pool exhausted",
    },
  },
  {
    name: "search_traces",
    arguments: {
      condition: "latency_ms > 10000 or status_code = ERROR",
      projectId: "production-agent-platform",
      limit: 500,
    },
    result: {
      traces: 500,
      errorRate: 0.184,
      commonPath: "agent > tool > database",
    },
  },
  {
    name: "get_deployment_status",
    arguments: {
      service: "orchestrator",
      environment: "production",
      region: "us-west-2",
    },
    result: { desired: 120, ready: 83, image: "orchestrator:2026.07.23-rc4" },
  },
  {
    name: "get_feature_flags",
    arguments: {
      tenantId: "enterprise-1042",
      service: "orchestrator",
      includeDisabled: true,
    },
    result: {
      flags: 147,
      recentlyChanged: ["parallel-tools-v3", "adaptive-retry-budget"],
    },
  },
  {
    name: "get_recent_changes",
    arguments: {
      services: ["api-gateway", "orchestrator", "model-runtime"],
      since: "2026-07-23T14:00:00Z",
    },
    result: {
      deploys: 3,
      migrations: 1,
      configChanges: 7,
      featureFlagChanges: 12,
    },
  },
  {
    name: "query_read_replica",
    arguments: {
      database: "agent-state",
      sql: "select state, count(*) from runs where created_at > now() - interval '1 hour' group by state",
      statementTimeoutMs: 10_000,
    },
    result: {
      error: "statement timeout after 10000ms",
      retryable: true,
      database: "agent-state-read-us-west-2b",
    },
  },
  {
    name: "fetch_runbook",
    arguments: {
      service: "orchestrator",
      symptom: "database pool exhaustion",
      version: "latest",
    },
    result: {
      runbookId: "rb-orchestrator-db-17",
      steps: 14,
      escalationAfterMinutes: 10,
    },
  },
  {
    name: "create_incident_timeline",
    arguments: {
      incidentId: "INC-2026-07142",
      occurredAt: "2026-07-23T15:42:11Z",
      summary:
        "Database pool saturation began immediately after the orchestrator rollout reached 35%.",
      evidenceLinks: [
        "https://metrics.example/graph/42",
        "https://traces.example/query/17",
      ],
    },
    result: { eventId: "timeline-event-9917", created: true },
  },
  {
    name: "page_on_call",
    arguments: {
      team: "agent-platform",
      severity: "sev1",
      message:
        "Production orchestration error rate is 18.4%; database connection pools are exhausted.",
    },
    result: {
      pageId: "PAGE-8812",
      acknowledgedBy: "oncall@example.com",
      acknowledgedInSeconds: 47,
    },
  },
] as const;

function getToolCall({
  call,
  callIndex,
}: {
  call: (typeof PRODUCTION_TOOL_CALLS)[number];
  callIndex: number;
}) {
  return {
    tool_call: {
      id: `call_${String(callIndex + 1).padStart(3, "0")}_${call.name}`,
      function: {
        name: call.name,
        arguments: JSON.stringify(call.arguments),
      },
    },
  };
}

function getToolResultMessage({
  call,
  callIndex,
}: {
  call: (typeof PRODUCTION_TOOL_CALLS)[number];
  callIndex: number;
}) {
  return {
    message: {
      role: "tool",
      tool_call_id: `call_${String(callIndex + 1).padStart(3, "0")}_${call.name}`,
      name: call.name,
      content: JSON.stringify(call.result),
    },
  };
}

const excessiveRetrieverSpan = createSpanInfoFixture({
  spanKind: "retriever",
  input: {
    mimeType: "text",
    value:
      "Find every production runbook, postmortem, change record, and architecture note relevant to database pool exhaustion in the agent orchestration path.",
  },
  attributes: JSON.stringify({
    retrieval: {
      documents: Array.from({ length: 10 }, (_unused, documentIndex) => ({
        document: {
          id: `production-knowledge-${String(documentIndex + 1).padStart(3, "0")}`,
          content: `Production knowledge document ${documentIndex + 1}. ${"This section contains operational context, remediation guidance, ownership details, and historical incident evidence. ".repeat(4)}`,
          score: 0.99 - documentIndex / 100,
          metadata: JSON.stringify({
            source: ["runbook", "postmortem", "architecture", "change-record"][
              documentIndex % 4
            ],
            service: ["orchestrator", "model-runtime", "api-gateway"][
              documentIndex % 3
            ],
            version: `2026.${String((documentIndex % 12) + 1).padStart(2, "0")}`,
          }),
        },
      })),
    },
  }),
  documentRetrievalMetrics: Array.from(
    { length: 10 },
    (_unused, metricIndex) => ({
      evaluationName: `enterprise retrieval evaluation ${metricIndex + 1} with a deliberately long name`,
      hit: metricIndex % 3 === 0 ? 0 : 1,
      ndcg: 0.99 - metricIndex / 50,
      precision: 0.97 - metricIndex / 60,
    })
  ),
});

const excessiveRerankerSpan = createSpanInfoFixture({
  spanKind: "reranker",
  attributes: JSON.stringify({
    reranker: {
      query:
        "Rank operational evidence for a production incident involving agent failures, database pool saturation, a partial rollout, and cross-region retry amplification.",
      input_documents: Array.from({ length: 10 }, (_unused, documentIndex) => ({
        document: {
          id: `reranker-input-${String(documentIndex + 1).padStart(3, "0")}`,
          content: `Candidate evidence ${documentIndex + 1}: ${"observability signal and operational context ".repeat(6)}`,
          score: 0.5 + (documentIndex % 10) / 100,
        },
      })),
      output_documents: Array.from(
        { length: 10 },
        (_unused, documentIndex) => ({
          document: {
            id: `reranker-output-${String(documentIndex + 1).padStart(3, "0")}`,
            content: `Ranked evidence ${documentIndex + 1}: ${"high-confidence incident correlation with supporting telemetry ".repeat(6)}`,
            score: 0.99 - documentIndex / 100,
          },
        })
      ),
    },
  }),
});

const excessiveEmbeddingSpan = createSpanInfoFixture({
  spanKind: "embedding",
  attributes: JSON.stringify({
    embedding: {
      model_name: "text-embedding-3-large-production-batch",
      embeddings: Array.from({ length: 10 }, (_unused, embeddingIndex) => ({
        embedding: {
          text: `Embedding input ${embeddingIndex + 1}: ${"A realistically long chunk of enterprise documentation containing procedures, caveats, code identifiers, and cross-references. ".repeat(5)}`,
        },
      })),
    },
  }),
});

const excessiveToolSchemasSpan = createSpanInfoFixture({
  spanKind: "llm",
  attributes: JSON.stringify({
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      tools: PRODUCTION_TOOLS.map((tool) => ({
        tool: {
          json_schema: JSON.stringify({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              strict: true,
              parameters: {
                type: "object",
                properties: tool.properties,
                required: tool.required,
                additionalProperties: false,
              },
            },
          }),
        },
      })),
    },
  }),
});

const firstToolCallBatch = PRODUCTION_TOOL_CALLS.slice(0, 5);
const secondToolCallBatch = PRODUCTION_TOOL_CALLS.slice(5);
const excessiveToolCallsSpan = createSpanInfoFixture({
  spanKind: "llm",
  input: {
    mimeType: "text",
    value:
      "Investigate the production incident, establish a defensible timeline, notify the owners, and prepare the safest remediation plan. Do not make a production change without approval.",
  },
  attributes: JSON.stringify({
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      output_messages: [
        {
          message: {
            role: "assistant",
            content:
              "I will gather telemetry and change context in parallel before taking action.",
            tool_calls: firstToolCallBatch.map((call, callIndex) =>
              getToolCall({ call, callIndex })
            ),
          },
        },
        ...firstToolCallBatch.map((call, callIndex) =>
          getToolResultMessage({ call, callIndex })
        ),
        {
          message: {
            role: "assistant",
            content:
              "The rollout strongly correlates with the regression. I will retrieve the runbook, document the timeline, escalate, and request a reviewed rollback.",
            tool_calls: secondToolCallBatch.map((call, callIndex) =>
              getToolCall({
                call,
                callIndex: callIndex + firstToolCallBatch.length,
              })
            ),
          },
        },
        ...secondToolCallBatch.map((call, callIndex) =>
          getToolResultMessage({
            call,
            callIndex: callIndex + firstToolCallBatch.length,
          })
        ),
      ],
    },
  }),
});

const excessiveToolErrorSpan = createSpanInfoFixture({
  spanKind: "tool",
  statusCode: "ERROR",
  statusMessage:
    "Tool execution failed after three attempts. The read replica exceeded its statement timeout, the retry budget was exhausted, and the fallback region rejected the request because the incident-scoped database credential had expired.",
  input: {
    mimeType: "json",
    value: JSON.stringify(
      {
        database: "agent-state",
        sql: "select tenant_id, state, count(*), percentile_cont(0.99) within group (order by latency_ms) from agent_runs where created_at > now() - interval '6 hours' group by tenant_id, state order by count(*) desc",
        regions: ["us-west-2", "us-east-1", "eu-west-1"],
        statementTimeoutMs: 30_000,
        retryPolicy: {
          attempts: 3,
          backoff: "exponential",
          maximumDelayMs: 5000,
        },
      },
      null,
      2
    ),
  },
  output: {
    mimeType: "json",
    value: JSON.stringify(
      {
        error: {
          type: "ToolExecutionError",
          code: "RETRY_BUDGET_EXHAUSTED",
          message: "All database diagnostic attempts failed.",
          attempts: [
            { region: "us-west-2", error: "statement timeout after 30000ms" },
            { region: "us-east-1", error: "connection pool unavailable" },
            { region: "eu-west-1", error: "incident credential expired" },
          ],
          remediation: {
            owner: "database-platform",
            runbook: "rb-database-diagnostics-credential-refresh",
            escalationPolicy: "db-platform-primary",
          },
        },
      },
      null,
      2
    ),
  },
  attributes: JSON.stringify({
    tool: {
      name: "query_read_replica",
      description:
        "Runs a strictly read-only, incident-scoped diagnostic query against isolated replicas with regional fallback and an audited retry budget.",
      parameters: {
        database: "agent-state",
        regions: ["us-west-2", "us-east-1", "eu-west-1"],
        accessMode: "read-only",
        incidentId: "INC-2026-07142",
        audit: {
          requestedBy: "incident-triage-agent",
          approvedBy: "oncall@example.com",
          approvalExpiresAt: "2026-07-23T17:00:00Z",
        },
      },
    },
  }),
});

const meta = {
  title: "Detail panel/Span info",
  component: SpanInfo,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SpecializedSpanKinds: Story = {
  args: { span: llmSpan },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="LLM">
        <SpanInfo span={llmSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Retriever">
        <SpanInfo span={retrieverSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Reranker">
        <SpanInfo span={rerankerSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Embedding">
        <SpanInfo span={embeddingSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Tool">
        <SpanInfo span={toolSpan} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};

export const LongInvocationParameters: Story = {
  args: { span: longInvocationParametersSpan },
};

export const ExcessiveContent: Story = {
  args: { span: excessiveToolCallsSpan },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Retriever · 10 documents and 10 metric sets">
        <SpanInfo span={excessiveRetrieverSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Reranker · 10 inputs and 10 outputs">
        <SpanInfo span={excessiveRerankerSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Embedding · 10 long inputs">
        <SpanInfo span={excessiveEmbeddingSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="LLM · 10 mixed-size production tools">
        <SpanInfo span={excessiveToolSchemasSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="LLM · 10 production tool calls across two rounds">
        <SpanInfo span={excessiveToolCallsSpan} />
      </DetailPanelExample>
      <DetailPanelExample title="Tool · exhausted retries and regional failures">
        <SpanInfo span={excessiveToolErrorSpan} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
