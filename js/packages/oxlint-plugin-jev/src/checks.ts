/**
 * The checks: the human-reviewed constants of this plugin.
 *
 * TypeSafe's own guidance is that the questions and thresholds are the part
 * humans most need to review, so they all live in this one file. Each check:
 *
 *  1. `appliesTo` — deterministic AST gate (which usages trigger it);
 *  2. `precheck`  — anything code can decide outright (report or skip without jev);
 *  3. `questions` — narrow, atomic jev questions that cite `state` paths;
 *  4. `decide`    — deterministic mapping from probabilities to a finding.
 *
 * Guidance text is loaded from the bundled Phoenix skills and placed into
 * `state.guidance.<check id>` so the model judges against the shipped docs.
 */
import type { AttributeEntry, CallFact, Facts } from "./extract.js";
import { registerResultIsExported } from "./extract.js";
import type { GuidanceRef } from "./guidance.js";
import { loadGuidance } from "./guidance.js";
import type { Answer, EntryType, Question } from "./jev/types.js";

export interface CheckOptions {
  /** Probability of a violation required before reporting a Noul-backed finding. */
  threshold: number;
  /** Confidence required before acting on a Choice answer. */
  minConfidence: number;
}

export const DEFAULT_OPTIONS: CheckOptions = {
  threshold: 0.75,
  minConfidence: 0.6,
};

export interface Finding {
  message: string;
  anchor?: CallFact;
  /** Probability or confidence backing the finding, for the message. */
  score: number;
}

export type Precheck =
  | "ask"
  | "skip"
  | { violation: Finding }
  /** Report these, then continue with `then`. */
  | { violations: Finding[]; then: "ask" | "skip" };

export interface QuestionSpec {
  key: string;
  question: Question;
  anchor?: CallFact;
}

export interface Check {
  id: string;
  /** Key used under `state.guidance` and in question text. */
  stateKey: string;
  title: string;
  guidance: GuidanceRef[];
  appliesTo(facts: Facts): CallFact[];
  precheck?(facts: Facts, anchors: CallFact[]): Precheck;
  /** Extra state this check needs beyond the shared file/facts/guidance. */
  extraState?(facts: Facts, anchors: CallFact[]): Record<string, EntryType>;
  questions(facts: Facts, anchors: CallFact[]): QuestionSpec[];
  decide(
    answer: Answer,
    spec: QuestionSpec,
    options: CheckOptions,
    facts: Facts
  ): Finding | undefined;
}

const PHOENIX_OTEL = "@arizeai/phoenix-otel";
const OPENINFERENCE_CORE = "@arizeai/openinference-core";

const isRegisterCall = (c: CallFact) =>
  c.name === "register" && c.source === PHOENIX_OTEL;
const SPAN_WRAPPERS = new Set([
  "withSpan",
  "traceChain",
  "traceAgent",
  "traceTool",
  "traceLLM",
  "traceRetriever",
  "traceReranker",
  "traceEmbedding",
  "traceGuardrail",
  "traceEvaluator",
  "tracePrompt",
]);
const isSpanWrapperCall = (c: CallFact) =>
  SPAN_WRAPPERS.has(c.name) &&
  (c.source === OPENINFERENCE_CORE || c.source === PHOENIX_OTEL);

// ---------------------------------------------------------------------------

const flushBeforeExit: Check = {
  id: "flush-before-exit",
  stateKey: "flush_before_exit",
  title: "Flush spans before the process exits",
  guidance: [
    { skill: "phoenix-tracing", file: "references/setup-typescript.md" },
    { skill: "phoenix-tracing", file: "references/production-typescript.md" },
  ],
  appliesTo: (facts) => facts.targetCalls.filter(isRegisterCall),
  precheck(facts, anchors) {
    // `batch: false` exports each span as it ends; guidance says no shutdown needed.
    if (anchors.every((a) => a.registerOptions?.batch === false)) return "skip";
    if (facts.flushCalls.length > 0) return "ask";
    // The provider is handed to another module; flushing is its job. Cross-file
    // analysis is out of scope for a single-file lint rule.
    if (registerResultIsExported(facts)) return "skip";
    // Custom processors may or may not batch — that is a judgement call for jev.
    if (anchors.some((a) => a.registerOptions?.customSpanProcessors))
      return "ask";
    return {
      violation: {
        message:
          "register() is called but the returned provider is never flushed (no shutdown()/forceFlush()) and not exported for a caller to flush. Queued spans are dropped when the process exits.",
        anchor: anchors[0],
        score: 1,
      },
    };
  },
  questions: () => [
    {
      key: "flush_before_exit",
      question: {
        type: "noul",
        instructions: {
          question:
            "Judging only the code in `code.text`, are spans queued by the tracer provider returned from register() flushed on every path by which this process can end: normal completion, a thrown error or rejected promise, and termination signals?",
          guidance: "`guidance.flush_before_exit`",
          inspect: [
            "`facts.registerOptions` — if `batch` is false, or `spanProcessors` are all Simple (non-batching) processors, spans export as they end and no flush is required",
            "`facts.flushCalls` — every shutdown()/forceFlush() call and its line",
            "`facts.processHandlers` — which process events are handled",
            "whether the only flush sits on the success path (end of main()) with no catch/finally or signal handler that also flushes",
          ],
          note: "A long-running server that flushes on SIGTERM/SIGINT counts as covered. A script whose flush is reached only when main() resolves does not.",
        },
        criteria: {
          true: "Every realistic exit path — success, error, and the termination signals relevant to this kind of program — reaches a flush or shutdown of the provider.",
          false:
            "At least one realistic exit path skips the flush: e.g. errors are caught and the process exits without flushing, or the flush runs only when the happy path completes.",
        },
      },
      anchor: undefined,
    },
  ],
  decide(answer, _spec, options) {
    if (answer.type !== "noul") return undefined;
    const pViolation = 1 - answer.noul;
    if (pViolation < options.threshold) return undefined;
    return {
      message:
        "Spans may be dropped on exit: the provider from register() is not flushed on every exit path (success, error, and signals).",
      score: pViolation,
    };
  },
};

// ---------------------------------------------------------------------------

const SPAN_KIND_FILES: Record<string, string> = {
  LLM: "span-llm.md",
  CHAIN: "span-chain.md",
  RETRIEVER: "span-retriever.md",
  TOOL: "span-tool.md",
  AGENT: "span-agent.md",
  EMBEDDING: "span-embedding.md",
  RERANKER: "span-reranker.md",
  GUARDRAIL: "span-guardrail.md",
  EVALUATOR: "span-evaluator.md",
};

let spanKindCriteria: Record<string, EntryType> | undefined;
function getSpanKindCriteria(): Record<string, EntryType> {
  if (spanKindCriteria) return spanKindCriteria;
  spanKindCriteria = {};
  for (const [kind, file] of Object.entries(SPAN_KIND_FILES)) {
    spanKindCriteria[kind] = loadGuidance({
      skill: "phoenix-tracing",
      file: `references/${file}`,
    }).text;
  }
  spanKindCriteria.PROMPT =
    "Prompt construction, rendering, or templating — building the text sent to a model, not calling it.";
  return spanKindCriteria;
}

const spanKindMatchesBody: Check = {
  id: "span-kind-matches-body",
  stateKey: "span_kind",
  title:
    "Declared OpenInference span kind matches what the wrapped function does",
  guidance: [
    {
      skill: "phoenix-tracing",
      file: "references/instrumentation-manual-typescript.md",
    },
    { skill: "phoenix-tracing", file: "references/span-chain.md" },
    { skill: "phoenix-tracing", file: "references/sessions-typescript.md" },
  ],
  appliesTo: (facts) =>
    facts.targetCalls.filter(
      (c) => isSpanWrapperCall(c) && c.declaredKind !== undefined
    ),
  extraState: (_facts, anchors) => ({
    spans: anchors.map((a, i) => ({
      index: i,
      declared_kind: a.declaredKind ?? null,
      call: a.callText,
      statement: a.statementText,
    })),
  }),
  questions: (_facts, anchors) =>
    anchors.map((anchor, i) => ({
      key: `span_kind_${i}`,
      anchor,
      question: {
        type: "choice",
        instructions: {
          question: `Which OpenInference span kind best describes what the function wrapped at \`code.spans[${i}].call\` actually does?`,
          focus:
            "Judge by the wrapped function's behaviour — what it calls and returns — not by the kind the developer declared.",
          reference:
            "`guidance.span_kind` lists the wrappers and their intended use, the CHAIN span spec, and how a root interaction span relates to the agent/LLM spans nested under it.",
          note: "A wrapper whose body only delegates to an LLM or agent client (model.generate, agent.generate, llm.summarize) is the CHAIN or AGENT boundary around that call; the LLM span itself comes from auto-instrumentation of the client. Answer LLM only when the wrapped code performs the model request directly (builds the request, calls the provider API).",
        },
        criteria: getSpanKindCriteria(),
      },
    })),
  decide(answer, spec, options) {
    if (answer.type !== "choice" || !spec.anchor?.declaredKind)
      return undefined;
    if (answer.choice === spec.anchor.declaredKind) return undefined;
    if (answer.confidence < options.minConfidence) return undefined;
    return {
      anchor: spec.anchor,
      score: answer.confidence,
      message: `Span is declared ${spec.anchor.declaredKind} but the wrapped function behaves like a ${answer.choice} span (p=${(answer.probabilities[answer.choice] ?? 0).toFixed(2)}). Use the matching kind so Phoenix renders and evaluates it correctly.`,
    };
  },
};

// ---------------------------------------------------------------------------

const noSessionWrapper: Check = {
  id: "no-session-wrapper",
  stateKey: "no_session_wrapper",
  title: "Set session.id via withSpan directly, not through a custom wrapper",
  guidance: [
    { skill: "phoenix-tracing", file: "references/sessions-typescript.md" },
  ],
  appliesTo: (facts) =>
    facts.targetCalls.filter(
      (c) => c.name === "withSpan" && isSpanWrapperCall(c)
    ),
  precheck: (facts) => (facts.fileText.includes("session.id") ? "ask" : "skip"),
  questions: (_facts, anchors) => [
    {
      key: "no_session_wrapper",
      anchor: anchors[0],
      question: {
        type: "noul",
        instructions: {
          question:
            "Does `code.text` define a reusable helper function whose purpose is to call withSpan and inject `session.id` on behalf of callers, instead of calling withSpan directly at each use site with the session attribute?",
          guidance: "`guidance.no_session_wrapper`",
        },
        criteria: {
          true: "A function/const is exported or reused that wraps withSpan and supplies `session.id` (or the SESSION_ID constant) so callers do not pass it themselves.",
          false:
            "withSpan is called directly where spans are created, with `session.id` passed in that call's attributes; or session.id is set through the OpenTelemetry context API.",
        },
      },
    },
  ],
  decide(answer, spec, options) {
    if (answer.type !== "noul" || answer.noul < options.threshold)
      return undefined;
    return {
      anchor: spec.anchor,
      score: answer.noul,
      message:
        'Custom wrapper around withSpan for session.id. Call withSpan directly with `attributes: { "session.id": SESSION_ID }` at each use site.',
    };
  },
};

// ---------------------------------------------------------------------------

const esmManualInstrumentation: Check = {
  id: "esm-manual-instrumentation",
  stateKey: "esm_manual_instrumentation",
  title: "ESM modules instrument LLM libraries explicitly",
  guidance: [
    { skill: "phoenix-tracing", file: "references/setup-typescript.md" },
    {
      skill: "phoenix-tracing",
      file: "references/instrumentation-auto-typescript.md",
    },
  ],
  appliesTo: (facts) => facts.targetCalls.filter(isRegisterCall),
  precheck: (facts) =>
    facts.instrumentedLibraries.length > 0 ? "ask" : "skip",
  questions: (_facts, anchors) => [
    {
      key: "esm_manual_instrumentation",
      anchor: anchors[0],
      question: {
        type: "choice",
        instructions: {
          question:
            "In this ES module, how are the LLM libraries listed in `facts.instrumentedLibraries` made visible to Phoenix tracing?",
          guidance: "`guidance.esm_manual_instrumentation`",
          inspect: [
            "`facts.manuallyInstrumentCalls` and any registerInstrumentations() call",
            "import order in `code.text` — ESM imports are hoisted above register()",
            "whether the library emits OpenTelemetry natively (Vercel AI SDK `ai` via registerTelemetry / experimental_telemetry) so no OpenInference instrumentation is required",
          ],
        },
        criteria: {
          explicitly_instrumented: {
            what: "An OpenInference instrumentation is constructed and applied with manuallyInstrument()/registerInstrumentations() after register().",
          },
          native_telemetry: {
            what: "The library exports OpenTelemetry spans itself (e.g. Vercel AI SDK with telemetry enabled) so it needs no OpenInference instrumentation; register() is enough.",
          },
          relies_on_import_order: {
            what: "The library is imported in this module and expected to be auto-instrumented, but nothing calls manuallyInstrument()/registerInstrumentations(); under ESM hoisting the library loads before register() runs and its calls will not be traced.",
          },
        },
      },
    },
  ],
  decide(answer, spec, options) {
    if (answer.type !== "choice" || answer.choice !== "relies_on_import_order")
      return undefined;
    if (answer.confidence < options.minConfidence) return undefined;
    return {
      anchor: spec.anchor,
      score: answer.confidence,
      message:
        "ESM imports are hoisted above register(), so this library will not be auto-instrumented. Construct its OpenInference instrumentation and call manuallyInstrument() (see guidance).",
    };
  },
};

// ---------------------------------------------------------------------------

const HARDCODED_ATTRIBUTE_MIN_LENGTH = 20;

const SENSITIVE_TRUE: EntryType = {
  what: "The value denotes data about a person (identity, contact details, date of birth, government id, free text about them, health or financial detail) or a secret (API key, bearer token, password, cookie, raw request headers).",
  examples: [
    "user.email",
    "patient.birthDate",
    "visit.notes.diagnosis",
    "payment.cardNumber",
    "process.env.OPENAI_API_KEY",
    "req.headers.authorization",
  ],
};
const SENSITIVE_FALSE: EntryType = {
  what: "Operational data: token counts, model names, latencies, retry counts, request/trace ids, ids or names of non-person entities, feature flags, sizes.",
  examples: [
    "usage.totalTokens",
    "prompt.length / 4",
    "response.model",
    "Date.now() - started",
    "requestId",
  ],
  note: "A *count* of tokens is not a token. Judge by what the identifier denotes, not by substrings.",
};

const noSensitiveSpanAttributes: Check = {
  id: "no-sensitive-span-attributes",
  stateKey: "no_sensitive_span_attributes",
  title: "Personal or secret data does not flow into span attributes unmasked",
  guidance: [
    { skill: "phoenix-tracing", file: "references/production-typescript.md" },
    {
      skill: "phoenix-tracing",
      file: "references/fundamentals-universal-attributes.md",
    },
  ],
  appliesTo: (facts) =>
    facts.targetCalls.filter(
      (c) => isSpanWrapperCall(c) && c.spanData !== undefined
    ),
  precheck(_facts, anchors) {
    // Hardcoded literals never flow at runtime and are never sent to jev; a
    // long one is almost certainly a token or key pasted into an attribute.
    const violations: Finding[] = [];
    for (const anchor of anchors) {
      for (const attr of anchor.spanData?.attributes ?? []) {
        if (
          attr.valueKind === "literal" &&
          (attr.literalLength ?? 0) >= HARDCODED_ATTRIBUTE_MIN_LENGTH
        ) {
          violations.push({
            anchor,
            score: 1,
            message: `Span attribute "${attr.key}" is a hardcoded ${attr.literalLength}-character string literal (line ${attr.line}). Long literals in attributes are usually pasted secrets; read it from configuration and keep it out of spans. (Value was not sent to jev.)`,
          });
        }
      }
    }
    const dynamic = anchors.filter((a) => hasDynamicSpanData(a));
    return { violations, then: dynamic.length > 0 ? "ask" : "skip" };
  },
  extraState: (_facts, anchors) => ({
    span_data: anchors.filter(hasDynamicSpanData).map((a, i) => ({
      index: i,
      call: a.callText,
      attributes: dynamicAttributes(a).map((attr, j) => ({
        index: j,
        key: attr.key,
        value: attr.valueText,
      })),
      processInput: a.spanData?.processInput ?? null,
      processOutput: a.spanData?.processOutput ?? null,
    })),
  }),
  questions: (_facts, anchors) => {
    const specs: QuestionSpec[] = [];
    anchors.filter(hasDynamicSpanData).forEach((anchor, i) => {
      dynamicAttributes(anchor).forEach((attr, j) => {
        specs.push({
          key: `sensitive_${i}_attr_${j}`,
          anchor,
          question: {
            type: "noul",
            instructions: {
              question: `Does the value flowing at runtime into span attribute \`code.span_data[${i}].attributes[${j}]\` (key \`${attr.key}\`, value \`${attr.valueText}\`) denote personal, health, financial or secret data?`,
              guidance: "`guidance.no_sensitive_span_attributes`",
              note: "Custom attributes are never masked by OpenInference; only input/output values are.",
            },
            criteria: { true: SENSITIVE_TRUE, false: SENSITIVE_FALSE },
          },
        });
      });
      const d = anchor.spanData;
      if (d?.processInput !== undefined || d?.processOutput !== undefined) {
        specs.push({
          key: `sensitive_${i}_bulk`,
          anchor,
          question: {
            type: "noul",
            instructions: {
              question: `Do \`code.span_data[${i}].processInput\` / \`processOutput\` serialize an entire record or object wholesale (JSON.stringify(record), getInputAttributes(object), spreading it), such that any personal or secret fields it holds land in the span?`,
              guidance: "`guidance.no_sensitive_span_attributes`",
            },
            criteria: {
              true: {
                what: "A whole object/record is captured: JSON.stringify(visit), getInputAttributes(user), { ...customer }.",
              },
              false: {
                what: "Only a plain string (prompt, answer text) or a small hand-picked operational object is captured.",
                examples: [
                  "getInputAttributes(input) where input is a string prompt",
                  "getOutputAttributes(result.text)",
                ],
              },
            },
          },
        });
      }
    });
    return specs;
  },
  decide(answer, spec, options, facts) {
    if (answer.type !== "noul" || answer.noul < options.threshold)
      return undefined;
    const isBulk = spec.key.endsWith("_bulk");
    // Masking covers input/output values, so wholesale serialization is fine when it is on.
    if (isBulk && facts.maskingConfigured) return undefined;
    if (isBulk) {
      return {
        anchor: spec.anchor,
        score: answer.noul,
        message:
          "processInput/processOutput serialize a whole record into the span, so any personal fields it holds are captured. Pick the fields you need, or enable traceConfig.hideInputs/hideOutputs or the OPENINFERENCE_HIDE_* variables.",
      };
    }
    const m = /attributes\[(\d+)\]/.exec(
      String(
        spec.question.instructions &&
          (spec.question.instructions as { question: string }).question
      )
    );
    const attrIndex = m ? Number(m[1]) : -1;
    const attr = spec.anchor
      ? dynamicAttributes(spec.anchor)[attrIndex]
      : undefined;
    return {
      anchor: spec.anchor,
      score: answer.noul,
      message: `Span attribute "${attr?.key ?? "?"}" carries personal, health, financial or secret data (${attr?.valueText ?? ""}). Custom attributes are never masked; drop it or replace it with a non-identifying id.`,
    };
  },
};

function dynamicAttributes(anchor: CallFact): AttributeEntry[] {
  return (anchor.spanData?.attributes ?? []).filter(
    (a) => a.valueKind === "expression"
  );
}

function hasDynamicSpanData(anchor: CallFact): boolean {
  const d = anchor.spanData;
  if (!d) return false;
  return (
    d.processInput !== undefined ||
    d.processOutput !== undefined ||
    d.attributes.some((a) => a.valueKind === "expression")
  );
}

export const CHECKS: readonly Check[] = [
  flushBeforeExit,
  spanKindMatchesBody,
  noSessionWrapper,
  esmManualInstrumentation,
  noSensitiveSpanAttributes,
];
