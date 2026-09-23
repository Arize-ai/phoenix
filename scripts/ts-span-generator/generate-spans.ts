/**
 * Deterministic agent trace generator for Phoenix.
 *
 * Sends a realistic agent trace to a Phoenix instance: an "incident
 * copilot" investigating a checkout outage across ten LLM steps with
 * growing message history, tool calls, and tool results.
 *
 * Usage:
 *   npm start                        # sends to http://localhost:6006
 *   PHOENIX_COLLECTOR_ENDPOINT=...  npm start
 *   PHOENIX_PROJECT_NAME=...        npm start
 *
 * The traces land in the `incident-copilot` project by default.
 */

import { context as otelContext, trace, type Span } from "@opentelemetry/api";
import { register } from "@arizeai/phoenix-otel";

const PROJECT_NAME = process.env.PHOENIX_PROJECT_NAME ?? "incident-copilot";
const SESSION_ID = "incident-2026-08-06-checkout";
const USER_ID = "oncall@example.com";
const MODEL = "gpt-5.6-luna";

// ---------------------------------------------------------------------------
// Conversation
//
// One incident-investigation conversation. Each assistant message is produced
// by one LLM span whose input is every message before it, so span N has a
// strictly longer history than span N-1. Vocabulary is chosen to exercise
// fuzzy search: timeout/timed out/time-out, auth/authentication/401,
// database/databse (typo), pool/conn pool, rollback/rolled back.
// ---------------------------------------------------------------------------

type ToolCall = { name: string; arguments: string; id: string };
type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

const toolCall = (name: string, args: object, id: string): ToolCall => ({
  name,
  arguments: JSON.stringify(args),
  id,
});

const MESSAGES: Message[] = [
  {
    // 0
    role: "system",
    content:
      "You are IncidentCopilot, an SRE assistant. Investigate production " +
      "incidents using the provided tools. Be precise, cite evidence from " +
      "tool output, and distinguish symptoms from root causes.",
  },
  {
    // 1
    role: "user",
    content:
      "The checkout API has been returning 500s since about 09:40 UTC and " +
      "users are reporting failed payments. Can you investigate?",
  },
  {
    // 2
    role: "assistant",
    content: "Pulling recent error logs for the checkout API.",
    tool_calls: [
      toolCall(
        "search_logs",
        { service: "checkout-api", since: "09:40Z", severity: "error" },
        "call_001"
      ),
    ],
  },
  {
    // 3
    role: "tool",
    tool_call_id: "call_001",
    content: JSON.stringify(
      {
        matches: 4187,
        sample: [
          "09:41:12 ERROR connection timeout after 5000ms connecting to postgres-primary:5432",
          "09:41:15 WARN  retrying connect to postgres-primary (attempt 3/3)",
          "09:41:19 ERROR PaymentProcessor: upstream auth-service returned 401 Unauthorized",
          "09:42:03 ERROR db pool exhausted: no available connections (waited 5000ms)",
          "09:42:41 ERROR connection timed out; circuit breaker OPEN for postgres-primary",
        ],
      },
      null,
      2
    ),
  },
  {
    // 4
    role: "assistant",
    content:
      "Timeouts and pool exhaustion. Checking service metrics to size the impact.",
    tool_calls: [
      toolCall(
        "get_metrics",
        {
          service: "checkout-api",
          metrics: [
            "error_rate",
            "latency_p99_ms",
            "db_pool_active",
            "db_pool_waiting",
          ],
          window: "09:30-09:55Z",
        },
        "call_002"
      ),
    ],
  },
  {
    // 5
    role: "tool",
    tool_call_id: "call_002",
    content: JSON.stringify(
      {
        error_rate: 0.42,
        latency_p99_ms: 8700,
        db_pool_active: "100/100",
        db_pool_waiting: 63,
        baseline_error_rate: 0.002,
      },
      null,
      2
    ),
  },
  {
    // 6
    role: "assistant",
    content:
      "Interim finding: the database connection pool is fully saturated " +
      "(100/100 active, 63 waiting), which explains the connection " +
      "timeouts. The 401s from auth-service are most likely a symptom - " +
      "sessions timing out mid-request - not an authentication problem. " +
      "Next I'll check whether anything changed around 09:40.",
  },
  {
    // 7
    role: "user",
    content:
      "That tracks. We also just got paged about the databse being slow - " +
      "is that related or a separate incident?",
  },
  {
    // 8
    role: "assistant",
    content:
      "Checking the database's own health before assuming it's the same incident.",
    tool_calls: [
      toolCall(
        "get_metrics",
        {
          service: "postgres-primary",
          metrics: ["cpu_percent", "active_queries", "slow_queries_per_min"],
          window: "09:30-09:55Z",
        },
        "call_003"
      ),
    ],
  },
  {
    // 9
    role: "tool",
    tool_call_id: "call_003",
    content: JSON.stringify(
      {
        cpu_percent: 38,
        active_queries: 12,
        slow_queries_per_min: 0.4,
        note: "no slow-query regression detected in this window",
      },
      null,
      2
    ),
  },
  {
    // 10
    role: "assistant",
    content:
      "The database itself is healthy - CPU 38%, no slow-query regression. " +
      "The 'slow database' page is the same incident: requests queueing at " +
      "the connection pool layer look like database slowness from the " +
      "application side. Now checking what deployed around 09:40.",
    tool_calls: [
      toolCall(
        "get_config_diff",
        { service: "checkout-api", deploy: "v2026.08.06-1" },
        "call_004"
      ),
    ],
  },
  {
    // 11
    role: "tool",
    tool_call_id: "call_004",
    content: JSON.stringify(
      {
        deployed_at: "09:32Z",
        diff: {
          DB_POOL_MAX_CONNECTIONS: { before: 250, after: 100 },
          DB_CONNECT_TIMEOUT_MS: { before: 30000, after: 5000 },
          DB_KEEPALIVE: { before: false, after: true },
        },
      },
      null,
      2
    ),
  },
  {
    // 12
    role: "assistant",
    content:
      "Root cause identified. Deploy v2026.08.06-1 at 09:32 UTC reduced " +
      "DB_POOL_MAX_CONNECTIONS from 250 to 100 and cut the connect " +
      "time-out from 30s to 5s. At checkout's traffic level the smaller " +
      "conn pool saturates immediately and the aggressive timeout turns " +
      "queueing into hard failures. I recommend rolling back to " +
      "v2026.08.05-4.",
  },
  {
    // 13
    role: "user",
    content: "Agreed - please start the rollback.",
  },
  {
    // 14
    role: "assistant",
    content: "Initiating the rollback now.",
    tool_calls: [
      toolCall(
        "create_incident_action",
        {
          action: "rollback",
          service: "checkout-api",
          target: "v2026.08.05-4",
        },
        "call_005"
      ),
    ],
  },
  {
    // 15
    role: "tool",
    tool_call_id: "call_005",
    content: JSON.stringify(
      { status: "initiated", action_id: "act_7719", eta_minutes: 4 },
      null,
      2
    ),
  },
  {
    // 16
    role: "assistant",
    content:
      "Rollback to v2026.08.05-4 is in progress (ETA ~4 minutes). I'll " +
      "verify recovery once it completes.",
  },
  {
    // 17
    role: "user",
    content:
      "Rollback finished. Can you verify recovery and write a short " +
      "summary for the postmortem?",
  },
  {
    // 18
    role: "assistant",
    content: "Verifying post-rollback metrics.",
    tool_calls: [
      toolCall(
        "get_metrics",
        {
          service: "checkout-api",
          metrics: ["error_rate", "latency_p99_ms", "db_pool_active"],
          window: "last_10m",
        },
        "call_006"
      ),
    ],
  },
  {
    // 19
    role: "tool",
    tool_call_id: "call_006",
    content: JSON.stringify(
      { error_rate: 0.003, latency_p99_ms: 420, db_pool_active: "41/250" },
      null,
      2
    ),
  },
  {
    // 20 - the long final output message
    role: "assistant",
    content:
      "Recovery confirmed - error rate is back to baseline (0.3%) and p99 " +
      "latency is 420ms with the pool at 41/250.\n\n" +
      "## Postmortem summary\n\n" +
      "**Impact:** ~42% of checkout requests failed between 09:40 and " +
      "10:12 UTC; users saw failed payments and 500s.\n\n" +
      "**Root cause:** Deploy v2026.08.06-1 (09:32 UTC) reduced the " +
      "database connection pool from 250 to 100 connections and lowered " +
      "the connect timeout from 30s to 5s. Under normal checkout traffic " +
      "the pool saturated, and waiting requests hit the new 5s timeout " +
      "and failed hard.\n\n" +
      "**Notable symptoms (not causes):**\n" +
      "- 'Slow database' pages - postgres-primary was healthy; queueing at " +
      "the pool layer mimicked database slowness.\n" +
      "- 401 Unauthorized from auth-service - sessions timed out " +
      "mid-request; there was no authentication or authorization issue.\n\n" +
      "**Resolution:** Rolled back to v2026.08.05-4 at 10:08 UTC; recovery " +
      "confirmed by 10:12 UTC.\n\n" +
      "**Follow-ups:**\n" +
      "1. Add a pre-deploy check that flags connection-pool downsizing.\n" +
      "2. Alert on db_pool_waiting > 10 so saturation pages before users " +
      "notice.\n" +
      "3. Load-test pool configuration changes in staging.\n" +
      "4. Document that pool-layer queueing can masquerade as database " +
      "slowness and as auth failures.",
  },
];

// Second, trivially short conversation for contrast when switching spans.
const SHORT_MESSAGES: Message[] = [
  { role: "system", content: "You are IncidentCopilot, an SRE assistant." },
  { role: "user", content: "Quick one - what does 'error budget' mean?" },
  {
    role: "assistant",
    content:
      "An error budget is the amount of unreliability a service is allowed " +
      "before its SLO is violated - e.g. a 99.9% SLO leaves a 0.1% budget. " +
      "Teams spend it on releases and risk; when it's exhausted, they " +
      "prioritize reliability work.",
  },
];

// ---------------------------------------------------------------------------
// OpenInference attribute flattening
// ---------------------------------------------------------------------------

type Attributes = Record<string, string | number | boolean>;

function flattenMessage(prefix: string, i: number, msg: Message): Attributes {
  const attrs: Attributes = { [`${prefix}.${i}.message.role`]: msg.role };
  if (msg.content) {
    attrs[`${prefix}.${i}.message.content`] = msg.content;
  }
  if (msg.tool_call_id) {
    attrs[`${prefix}.${i}.message.tool_call_id`] = msg.tool_call_id;
  }
  (msg.tool_calls ?? []).forEach((tc, j) => {
    const base = `${prefix}.${i}.message.tool_calls.${j}.tool_call`;
    attrs[`${base}.id`] = tc.id;
    attrs[`${base}.function.name`] = tc.name;
    attrs[`${base}.function.arguments`] = tc.arguments;
  });
  return attrs;
}

function llmAttributes(
  inputMessages: Message[],
  outputMessage: Message
): Attributes {
  const attrs: Attributes = {
    "openinference.span.kind": "LLM",
    "llm.model_name": MODEL,
    "llm.provider": "openai",
    "session.id": SESSION_ID,
    "user.id": USER_ID,
    "input.mime_type": "application/json",
    "input.value": JSON.stringify({ messages: inputMessages }),
    "output.mime_type": "text/plain",
    "output.value": outputMessage.content ?? "",
  };
  inputMessages.forEach((m, i) => {
    Object.assign(attrs, flattenMessage("llm.input_messages", i, m));
  });
  Object.assign(attrs, flattenMessage("llm.output_messages", 0, outputMessage));
  const promptTokens = Math.floor(
    inputMessages.reduce((n, m) => n + (m.content?.length ?? 0), 0) / 4
  );
  const completionTokens =
    Math.floor((outputMessage.content?.length ?? 0) / 4) + 8;
  attrs["llm.token_count.prompt"] = promptTokens;
  attrs["llm.token_count.completion"] = completionTokens;
  attrs["llm.token_count.total"] = promptTokens + completionTokens;
  return attrs;
}

function toolAttributes(tc: ToolCall, result: string): Attributes {
  return {
    "openinference.span.kind": "TOOL",
    "tool.name": tc.name,
    "session.id": SESSION_ID,
    "user.id": USER_ID,
    "input.mime_type": "application/json",
    "input.value": tc.arguments,
    "output.mime_type": "application/json",
    "output.value": result,
  };
}

// ---------------------------------------------------------------------------
// Span emission
// ---------------------------------------------------------------------------

async function main() {
  const endpoint = (
    process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006"
  ).replace(/\/$/, "");

  const provider = register({ projectName: PROJECT_NAME });
  const tracer = trace.getTracer("ts-span-generator");

  // Start ~20 minutes ago so the data is inside recent time-range filters.
  let t = Date.now() - 20 * 60 * 1000;

  // ---- Trace 1: full incident investigation -----------------------------
  const root = tracer.startSpan("IncidentCopilot", {
    startTime: t,
    attributes: {
      "openinference.span.kind": "AGENT",
      "session.id": SESSION_ID,
      "user.id": USER_ID,
      "input.value": MESSAGES[1].content ?? "",
      "output.value": MESSAGES[20].content ?? "",
    },
  });
  const ctx = trace.setSpan(otelContext.active(), root);

  // Each assistant message is one LLM step; a following tool message becomes
  // a TOOL span for the call it answers.
  const assistantIndices = MESSAGES.flatMap((m, i) =>
    m.role === "assistant" ? [i] : []
  );
  assistantIndices.forEach((ai, step) => {
    const llmStart = t;
    t += (1.8 + 0.14 * ai) * 1000; // later steps take a bit longer
    const llm = tracer.startSpan(
      `chat ${MODEL}`,
      {
        startTime: llmStart,
        attributes: llmAttributes(MESSAGES.slice(0, ai), MESSAGES[ai]),
      },
      ctx
    );
    llm.end(t);

    // Tool span if the next message is this step's tool result
    const next = MESSAGES[ai + 1];
    if (next?.role === "tool") {
      const tc = MESSAGES[ai].tool_calls![0];
      const toolStart = t;
      t += (0.35 + 0.05 * (step + 1)) * 1000;
      const toolSpan = tracer.startSpan(
        tc.name,
        {
          startTime: toolStart,
          attributes: toolAttributes(tc, next.content ?? ""),
        },
        ctx
      );
      toolSpan.end(t);
    }

    // Small gap for user "thinking time" between turns
    if (next?.role === "user") {
      t += 6_000;
    }
  });

  root.end(t);

  // ---- Trace 2: short contrast conversation ------------------------------
  t += 30_000;
  const shortStart = t;
  const shortRoot = tracer.startSpan("IncidentCopilot", {
    startTime: shortStart,
    attributes: {
      "openinference.span.kind": "AGENT",
      "session.id": SESSION_ID,
      "user.id": USER_ID,
      "input.value": SHORT_MESSAGES[1].content ?? "",
      "output.value": SHORT_MESSAGES[2].content ?? "",
    },
  });
  const shortCtx = trace.setSpan(otelContext.active(), shortRoot);
  t += 1_400;
  const shortLlm = tracer.startSpan(
    `chat ${MODEL}`,
    {
      startTime: shortStart,
      attributes: llmAttributes(SHORT_MESSAGES.slice(0, 2), SHORT_MESSAGES[2]),
    },
    shortCtx
  );
  shortLlm.end(t);
  shortRoot.end(t);

  // Flush before exit
  await provider.shutdown();

  const nLlm = assistantIndices.length + 1;
  console.log(`✅ Sent 2 traces (${nLlm} LLM spans) to ${endpoint}`);
  console.log(`   Project: ${PROJECT_NAME}`);
  console.log(
    `   View: ${endpoint}/redirects/projects/${encodeURIComponent(PROJECT_NAME)}`
  );
}

await main();
