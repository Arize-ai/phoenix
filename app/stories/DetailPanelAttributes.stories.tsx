import type { Meta, StoryObj } from "@storybook/react";

import { SpanAttributes } from "@phoenix/pages/trace/SpanDetails";

import {
  DetailPanelExample,
  DetailPanelExamples,
} from "./detailPanelStoryHelpers";

const shortAttributes = JSON.stringify(
  {
    "openinference.span.kind": "LLM",
    "llm.model_name": "gpt-4.1-mini",
  },
  null,
  2
);

const longAttributes = JSON.stringify(
  {
    "openinference.span.kind": "LLM",
    llm: {
      provider: "openai",
      model_name: "gpt-4.1",
      token_count: { prompt: 1248, completion: 483, total: 1731 },
      invocation_parameters: {
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: "json_schema" },
      },
    },
    session: { id: "session-74ce77" },
    user: { id: "user-2048", role: "analyst" },
    tags: ["production", "customer-facing", "priority"],
    metadata: {
      deployment: { environment: "production", region: "us-west-2" },
      request: { retry: 2, cached: false, featureFlags: ["rag", "tools"] },
    },
  },
  null,
  2
);

const trashFireAttributes = JSON.stringify(
  {
    "openinference.span.kind": "LLM",
    "llm.model_name": "gpt-4.1",
    "llm.provider": "openai",
    "llm.invocation_parameters": JSON.stringify({
      temperature: "0.2",
      max_tokens: 2048,
      response_format: {
        type: "json_schema",
        json_schema: JSON.stringify({
          name: "incident_summary",
          strict: "true",
          schema: {
            type: "object",
            required: "summary,affected_services",
            properties: {
              summary: { type: "string" },
              affected_services: JSON.stringify({
                type: "array",
                items: { type: "string" },
              }),
              severity: { enum: ["sev1", "sev2", 3] },
            },
          },
        }),
      },
      extra_body: {
        user: JSON.stringify({
          id: "user-2048",
          tenant_id: 1042,
          plan: null,
        }),
        retry_policy:
          '{"attempts":3,"backoff_ms":[250,1000,"5s"],"jitter":true}',
        parallel_tool_calls: "false",
      },
    }),
    "llm.input_messages": JSON.stringify([
      {
        message: {
          role: "system",
          content:
            "You are the incident-triage assistant. Prefer current telemetry over cached runbooks.",
        },
      },
      {
        message: JSON.stringify({
          role: "user",
          content: [
            {
              type: "text",
              text: "Why is checkout returning 503s only for enterprise tenants?",
            },
            {
              type: "context",
              value: JSON.stringify({
                incident_id: "INC-2026-07142",
                tenant: { id: "enterprise-1042", tier: 4 },
                filters: JSON.stringify({
                  tenant: "enterprise-1042",
                  regions: ["us-west-2", "us-east-1"],
                  since: "now-6h",
                }),
              }),
            },
          ],
        }),
      },
    ]),
    "llm.output_messages": [
      {
        message: JSON.stringify({
          role: "assistant",
          content: "I found replica saturation and will query regional health.",
          tool_calls: [
            {
              tool_call: {
                id: "call_db_health_01J3",
                function: {
                  name: "query_read_replica",
                  arguments: JSON.stringify({
                    regions: ["us-west-2", "us-east-1"],
                    timeout_ms: "30000",
                    include_credentials: false,
                  }),
                },
              },
            },
          ],
        }),
      },
      {
        message: {
          role: "tool",
          tool_call_id: "call_db_health_01J3",
          content:
            '{"status":503,"error":"pool_exhausted","retry_after":"PT5S"}',
        },
      },
    ],
    "http.request.method": "POST",
    "url.full": "https://api.example.com/v1/checkout?region=us-west-2",
    "server.address": "checkout-api.production.svc.cluster.local:8443",
    "http.request.header.x-forwarded-for": '["203.0.113.42","10.48.7.19"]',
    "session.id": 74102,
    tags: '["production","customer-facing",{"priority":"p1"}]',
    metadata: {
      workflow: "incident-triage",
      deployment: {
        environment: "production",
        region: "us-west-2",
        release: "checkout-api@2026.07.23+sha.8e41c2a",
        pod: "checkout-api-7d9f8b6c5c-k2r8q",
      },
      request_context: JSON.stringify({
        tenant_id: "enterprise-1042",
        headers: {
          authorization: "[REDACTED]",
          "x-request-id": "req_01J3J8N6T7CX9QV2F5B4K1M0PZ",
          traceparent:
            "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        },
        feature_flags: [
          "rag",
          JSON.stringify({ tools: true, shadow_mode_percent: "5" }),
        ],
      }),
      breadcrumbs: [
        { at: "16:41:02.119Z", event: "request.accepted" },
        JSON.stringify({
          at: "16:41:32.204Z",
          event: "replica.timeout",
          duration_ms: "30000",
        }),
        "16:41:37.881Z fallback credential expired; continuing without eu-west-1",
      ],
      upstream_response: JSON.stringify({
        status: 503,
        headers: { "retry-after": 5, "content-type": "application/json" },
        body: JSON.stringify({
          error: "pool_exhausted",
          replicas: [
            { region: "us-west-2", state: "saturated", lag_ms: 18 },
            { region: "us-east-1", state: "lagging", lag_ms: "unknown" },
          ],
        }),
        received_at: "2026-07-23T16:41:37.902Z",
      }),
      exception: {
        type: "TimeoutError",
        message: "read replica query exceeded 30000ms after 3 attempts",
        stacktrace:
          "TimeoutError: query exceeded deadline\n    at ReplicaClient.execute (db.ts:184:17)\n    at async diagnoseCheckout (triage.ts:91:5)",
      },
    },
  },
  null,
  2
);

const meta = {
  title: "Detail panel/Attributes",
  component: SpanAttributes,
  parameters: {
    width: "fill",
  },
} satisfies Meta<typeof SpanAttributes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Permutations: Story = {
  args: { attributes: shortAttributes },
  render: () => (
    <DetailPanelExamples>
      <DetailPanelExample title="Empty object">
        <SpanAttributes attributes="{}" />
      </DetailPanelExample>
      <DetailPanelExample title="Short and flat">
        <SpanAttributes attributes={shortAttributes} />
      </DetailPanelExample>
      <DetailPanelExample title="Long and neat">
        <SpanAttributes attributes={longAttributes} />
      </DetailPanelExample>
      <DetailPanelExample
        title="Stringified JSON trash fire"
        description="Valid outer JSON with realistic telemetry whose subdocuments are inconsistently shaped, typed, and stringified."
      >
        <SpanAttributes attributes={trashFireAttributes} />
      </DetailPanelExample>
      <DetailPanelExample
        title="Malformed payload"
        description="The production fallback displays the original value when attributes are not valid JSON."
      >
        <SpanAttributes attributes={'{"valid": true, "truncated":'} />
      </DetailPanelExample>
    </DetailPanelExamples>
  ),
  tags: ["!dev"],
};
