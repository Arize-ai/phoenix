/**
 * `jev/guidance` — the single rule. Per file:
 *
 *   import scan ──► no Phoenix/OpenInference/OTel imports? ──► done (free)
 *        │
 *        ▼
 *   fact extraction (AST) ──► per-check precheck ──► deterministic findings
 *        │
 *        ▼
 *   one jev request: state = { code, facts, guidance }  questions = all checks
 *        │  (content-hash cache; sync bridge to a worker thread)
 *        ▼
 *   decide() per answer ──► context.report()
 */
import path from "node:path";

import { requestHash, resolveCacheDir, ResponseCache } from "../cache.js";
import type { Check, CheckOptions, Finding, QuestionSpec } from "../checks.js";
import { CHECKS, DEFAULT_OPTIONS } from "../checks.js";
import type { CallFact, Facts } from "../extract.js";
import {
  createFactCollector,
  registerResultIsExported,
  usesTargetPackages,
} from "../extract.js";
import { guidanceSource, loadGuidance } from "../guidance.js";
import { mockAnswers } from "../jev/mock.js";
import { callJevSync } from "../jev/sync.js";
import type {
  EntryType,
  Question,
  SystemOneRequest,
  SystemOneResponse,
} from "../jev/types.js";
import { API_KEY_ENV, DEFAULT_BASE_URL, DEFAULT_MODEL } from "../jev/types.js";
import type { Rule, RuleContext } from "../oxlintTypes.js";
import type { RedactPolicy } from "../redact.js";
import { REDACTION_NOTE, Redactor } from "../redact.js";

export type Mode = "live" | "mock" | "record" | "off";

const MAX_INLINE_FILE_CHARS = 24_000; // ~6k tokens; jev allows 32k tokens of state

let noticeShown = false;
function notice(message: string): void {
  if (noticeShown || process.env.OXLINT_JEV_QUIET) return;
  noticeShown = true;
  process.stderr.write(`oxlint-plugin-jev: ${message}\n`);
}

export function resolveMode(): Mode {
  const requested = (process.env.OXLINT_JEV_MODE ?? "auto").toLowerCase();
  if (
    requested === "live" ||
    requested === "mock" ||
    requested === "record" ||
    requested === "off"
  ) {
    return requested;
  }
  if (process.env[API_KEY_ENV]) return "live";
  notice(
    `${API_KEY_ENV} is not set; jev checks are skipped (set OXLINT_JEV_MODE=record to capture requests).`
  );
  return "off";
}

interface RuleOptions extends CheckOptions {
  redact: RedactPolicy;
}

function parseOptions(raw: unknown): RuleOptions {
  const o = (raw ?? {}) as Partial<RuleOptions>;
  return {
    redact: o.redact === "off" ? "off" : "all",
    threshold:
      typeof o.threshold === "number" ? o.threshold : DEFAULT_OPTIONS.threshold,
    minConfidence:
      typeof o.minConfidence === "number"
        ? o.minConfidence
        : DEFAULT_OPTIONS.minConfidence,
  };
}

interface Planned {
  check: Check;
  specs: QuestionSpec[];
}

function buildRequest(
  context: RuleContext,
  facts: Facts,
  planned: Planned[],
  redactor: Redactor
): SystemOneRequest {
  const guidance: Record<string, EntryType> = {};
  const extra: Record<string, EntryType> = {};
  const questions: Record<string, Question> = {};
  for (const { check, specs } of planned) {
    guidance[check.stateKey] = check.guidance.map((ref) => {
      const loaded = loadGuidance(ref);
      return { source: loaded.source, text: loaded.text };
    });
    Object.assign(
      extra,
      check.extraState?.(facts, check.appliesTo(facts)) ?? {}
    );
    for (const spec of specs) questions[spec.key] = spec.question;
  }
  const state: Record<string, EntryType> = {
    file: {
      path: path.relative(context.cwd, context.filename),
      language: /\.tsx?$/.test(context.filename) ? "typescript" : "javascript",
      module_system: "esm",
    },
    code: {
      redaction: redactor.policy === "off" ? "none" : REDACTION_NOTE,
      text:
        facts.fileText.length <= MAX_INLINE_FILE_CHARS
          ? redactor.text()
          : `<file too large to inline; ${facts.fileText.length} chars>`,
      ...extra,
    },
    facts: {
      imports: facts.targetImports.map((i) => ({
        source: i.source,
        name: i.imported,
        line: i.line,
      })),
      instrumentedLibraries: facts.instrumentedLibraries,
      manuallyInstrumentCalls: facts.manuallyInstrumentCalls,
      flushCalls: facts.flushCalls,
      processHandlers: facts.processHandlers,
      registerResultExported: registerResultIsExported(facts),
      registerOptions: facts.targetCalls
        .filter((c) => c.name === "register" && c.registerOptions)
        .map((c) => ({ line: c.line, ...c.registerOptions })) as EntryType,
    },
    guidance,
  };
  return {
    model: process.env.OXLINT_JEV_MODEL ?? DEFAULT_MODEL,
    state,
    questions,
  };
}

function report(
  context: RuleContext,
  check: Check,
  finding: Finding,
  anchorFallback?: CallFact
): void {
  const anchor = finding.anchor ?? anchorFallback;
  const sources = check.guidance.map(guidanceSource).join(", ");
  const diagnostic = {
    messageId: "finding",
    data: {
      id: check.id,
      message: finding.message,
      score: finding.score.toFixed(2),
      sources,
    },
  };
  if (anchor) context.report({ ...diagnostic, node: anchor.node });
  else context.report({ ...diagnostic, loc: { line: 1, column: 0 } });
}

function resolveAnswers(
  context: RuleContext,
  request: SystemOneRequest,
  mode: Mode
): SystemOneResponse | undefined {
  const cache = new ResponseCache(resolveCacheDir(context.cwd));
  const hash = requestHash(request);
  const cached = cache.get(hash);
  if (cached) return cached;
  if (mode === "record" || mode === "mock")
    cache.record(hash, context.filename, request);
  if (mode === "record") return undefined;
  if (mode === "mock") return mockAnswers(request, context.filename);

  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) {
    context.report({
      messageId: "unavailable",
      data: { reason: `${API_KEY_ENV} is not set` },
      loc: { line: 1, column: 0 },
    });
    return undefined;
  }
  const url = `${process.env.OXLINT_JEV_BASE_URL ?? DEFAULT_BASE_URL}/v1/systemone`;
  const result = callJevSync(request, { url, apiKey });
  if (!result.ok) {
    context.report({
      messageId: "unavailable",
      data: { reason: result.error },
      loc: { line: 1, column: 0 },
    });
    return undefined;
  }
  cache.set(hash, result.response);
  return result.response;
}

export const guidanceRule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Asks jev whether usage of Phoenix, OpenInference and OpenTelemetry follows the guidance in Phoenix's shipped agent skills",
      url: "https://github.com/Arize-ai/phoenix/tree/main/js/packages/oxlint-plugin-jev",
    },
    schema: [
      {
        type: "object",
        properties: {
          threshold: { type: "number", minimum: 0, maximum: 1 },
          minConfidence: { type: "number", minimum: 0, maximum: 1 },
          redact: { enum: ["all", "off"] },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      finding: "[jev:{{id}}] {{message}} (p={{score}}) — guidance: {{sources}}",
      unavailable: "[jev] guidance checks skipped: {{reason}}",
    },
  },
  create(context) {
    const mode = resolveMode();
    if (mode === "off") return {};
    const options = parseOptions(context.options[0]);
    const redactor = new Redactor(context.sourceCode, options.redact);
    const collector = createFactCollector(context, redactor);

    return {
      ...collector.visitor,
      "Program:exit"() {
        const facts = collector.finish();
        if (!usesTargetPackages(facts)) return;

        const planned: Planned[] = [];
        for (const check of CHECKS) {
          const anchors = check.appliesTo(facts);
          if (anchors.length === 0) continue;
          let pre = check.precheck?.(facts, anchors) ?? "ask";
          if (typeof pre === "object" && "violations" in pre) {
            for (const v of pre.violations)
              report(context, check, v, anchors[0]);
            pre = pre.then;
          }
          if (pre === "skip") continue;
          if (pre !== "ask") {
            report(context, check, pre.violation, anchors[0]);
            continue;
          }
          const specs = check.questions(facts, anchors);
          if (specs.length > 0) planned.push({ check, specs });
        }
        if (planned.length === 0) return;

        const request = buildRequest(context, facts, planned, redactor);
        const response = resolveAnswers(context, request, mode);
        if (!response) return;

        for (const { check, specs } of planned) {
          for (const spec of specs) {
            const answer = response.answers[spec.key];
            if (!answer) continue;
            const finding = check.decide(answer, spec, options, facts);
            if (finding)
              report(
                context,
                check,
                finding,
                spec.anchor ?? check.appliesTo(facts)[0]
              );
          }
        }
      },
    };
  },
};
