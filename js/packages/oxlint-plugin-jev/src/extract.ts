/**
 * Deterministic fact extraction from the AST. Everything that code can decide
 * cheaply and reliably is decided here; jev is only consulted for the
 * judgement calls that remain (see `checks.ts`).
 */
import type * as ESTree from "estree";

import type { RuleContext } from "./oxlintTypes.js";
import type { Redactor } from "./redact.js";

/** Packages whose import is the first signal that jev should be consulted. */
export const TARGET_PACKAGE_PATTERN =
  /^(@arizeai\/(phoenix-otel|phoenix-client|openinference-[\w-]+)|@opentelemetry\/[\w-]+)(\/.*)?$/;

/** Libraries that need OpenInference instrumentation to be traced. */
export const INSTRUMENTED_LIBRARY_PATTERN =
  /^(openai|@langchain\/[\w-]+|langchain|@anthropic-ai\/sdk|@google\/genai|@mastra\/core|ai|@ai-sdk\/[\w-]+)(\/.*)?$/;

export interface ImportFact {
  source: string;
  imported: string; // "default" | "*" | name
  local: string;
  line: number;
}

export interface CallFact {
  /** Imported (not local) name, e.g. `register`, `withSpan`. */
  name: string;
  source: string;
  node: ESTree.CallExpression;
  line: number;
  /** Source text of the enclosing top-level statement (capped). */
  statementText: string;
  /** Source text of the call itself. */
  callText: string;
  /** For span wrappers: declared kind from `kind:` option or wrapper name. */
  declaredKind?: string;
  /** For register(): what the options object literally says. */
  registerOptions?: RegisterOptionsFact;
  /** For span wrappers: what data is wired into the span. */
  spanData?: SpanDataFact;
}

export interface AttributeEntry {
  key: string;
  /** Redacted source of the value expression; literals become a placeholder. */
  valueText: string;
  valueKind: "literal" | "expression";
  /** Original length when the value is a string literal (never its content). */
  literalLength?: number;
  line: number;
}

export interface SpanDataFact {
  attributes: AttributeEntry[];
  processInput?: string;
  processOutput?: string;
}

export interface RegisterOptionsFact {
  keys: string[];
  /** Literal `batch` value when written as a boolean literal. */
  batch?: boolean;
  /** `spanProcessors` supplied, so the default (batched) exporter is replaced. */
  customSpanProcessors: boolean;
}

export interface Facts {
  filename: string;
  fileText: string;
  targetImports: ImportFact[];
  otherImports: ImportFact[];
  targetCalls: CallFact[];
  flushCalls: Array<{ text: string; line: number }>;
  processHandlers: Array<{ event: string; line: number }>;
  registerResultNames: string[];
  exportedNames: string[];
  instrumentedLibraries: string[];
  manuallyInstrumentCalls: number;
  /** hideInputs/hideOutputs set in a TraceConfig, or OPENINFERENCE_HIDE_* referenced. */
  maskingConfigured: boolean;
}

const MAX_STATEMENT_CHARS = 4_000;

const SPAN_WRAPPER_KINDS: Record<string, string> = {
  traceChain: "CHAIN",
  traceAgent: "AGENT",
  traceTool: "TOOL",
  traceLLM: "LLM",
  traceRetriever: "RETRIEVER",
  traceReranker: "RERANKER",
  traceEmbedding: "EMBEDDING",
  traceGuardrail: "GUARDRAIL",
  traceEvaluator: "EVALUATOR",
  tracePrompt: "PROMPT",
};

function lineOf(node: ESTree.Node): number {
  return node.loc?.start.line ?? 0;
}

function literalString(
  node: ESTree.Node | null | undefined
): string | undefined {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked ?? "").join("");
  }
  return undefined;
}

function registerOptionsOf(
  call: ESTree.CallExpression
): RegisterOptionsFact | undefined {
  const options = call.arguments[0];
  if (!options || options.type !== "ObjectExpression") return undefined;
  const fact: RegisterOptionsFact = { keys: [], customSpanProcessors: false };
  for (const prop of options.properties) {
    if (prop.type !== "Property") continue;
    const key =
      prop.key.type === "Identifier" ? prop.key.name : literalString(prop.key);
    if (!key) continue;
    fact.keys.push(key);
    if (
      key === "batch" &&
      prop.value.type === "Literal" &&
      typeof prop.value.value === "boolean"
    ) {
      fact.batch = prop.value.value;
    }
    if (key === "spanProcessors") fact.customSpanProcessors = true;
  }
  return fact;
}

function attributeEntriesOf(
  attributes: ESTree.ObjectExpression,
  redactor: Redactor
): AttributeEntry[] {
  const entries: AttributeEntry[] = [];
  for (const attr of attributes.properties) {
    if (attr.type !== "Property") continue;
    const key =
      attr.key.type === "Identifier" ? attr.key.name : literalString(attr.key);
    if (!key) continue;
    const value = attr.value as ESTree.Node;
    const literal =
      value.type === "Literal"
        ? String(value.value ?? "")
        : literalString(value);
    entries.push({
      key,
      valueText: redactor.textOf(value),
      valueKind: literal === undefined ? "expression" : "literal",
      literalLength: literal?.length,
      line: lineOf(attr),
    });
  }
  return entries;
}

function spanDataOf(
  name: string,
  call: ESTree.CallExpression,
  redactor: Redactor
): SpanDataFact | undefined {
  if (!(name === "withSpan" || name.startsWith("trace"))) return undefined;
  const options = call.arguments[1];
  if (!options || options.type !== "ObjectExpression") return undefined;
  const data: SpanDataFact = { attributes: [] };
  for (const prop of options.properties) {
    if (prop.type !== "Property") continue;
    const key =
      prop.key.type === "Identifier" ? prop.key.name : literalString(prop.key);
    const value = prop.value as ESTree.Node;
    if (key === "processInput") data.processInput = redactor.textOf(value);
    else if (key === "processOutput")
      data.processOutput = redactor.textOf(value);
    else if (key === "attributes" && value.type === "ObjectExpression") {
      data.attributes.push(...attributeEntriesOf(value, redactor));
    }
  }
  const found =
    data.attributes.length > 0 ||
    data.processInput !== undefined ||
    data.processOutput !== undefined;
  return found ? data : undefined;
}

function declaredKindOf(
  name: string,
  call: ESTree.CallExpression
): string | undefined {
  const fromName = SPAN_WRAPPER_KINDS[name];
  if (fromName) return fromName;
  if (name !== "withSpan") return undefined;
  const options = call.arguments[1];
  if (!options || options.type !== "ObjectExpression") return undefined;
  for (const prop of options.properties) {
    if (prop.type !== "Property") continue;
    const key =
      prop.key.type === "Identifier" ? prop.key.name : literalString(prop.key);
    if (key === "kind") return literalString(prop.value as ESTree.Node);
  }
  return undefined;
}

/**
 * Builds a visitor that accumulates `Facts`; call `finish()` from
 * `Program:exit`.
 */
export function createFactCollector(context: RuleContext, redactor: Redactor) {
  const { sourceCode } = context;
  const bindings = new Map<string, { source: string; imported: string }>();
  const facts: Facts = {
    filename: context.filename,
    fileText: sourceCode.text,
    targetImports: [],
    otherImports: [],
    targetCalls: [],
    flushCalls: [],
    processHandlers: [],
    registerResultNames: [],
    exportedNames: [],
    instrumentedLibraries: [],
    manuallyInstrumentCalls: 0,
    maskingConfigured: /OPENINFERENCE_HIDE_/.test(sourceCode.text),
  };

  function topLevelStatementText(node: ESTree.Node): string {
    const ancestors = sourceCode.getAncestors(node);
    // ancestors[0] is Program; ancestors[1] is the top-level statement.
    const statement = ancestors[1] ?? node;
    const text = redactor.textOf(statement);
    return text.length > MAX_STATEMENT_CHARS ? redactor.textOf(node) : text;
  }

  function resolveCallee(
    callee: ESTree.Expression | ESTree.Super
  ): { name: string; source: string } | undefined {
    if (callee.type === "Identifier") {
      const b = bindings.get(callee.name);
      return b
        ? {
            name: b.imported === "default" ? callee.name : b.imported,
            source: b.source,
          }
        : undefined;
    }
    if (
      callee.type === "MemberExpression" &&
      callee.object.type === "Identifier" &&
      !callee.computed
    ) {
      const b = bindings.get(callee.object.name);
      if (b && b.imported === "*" && callee.property.type === "Identifier") {
        return { name: callee.property.name, source: b.source };
      }
    }
    return undefined;
  }

  const visitor = {
    ImportDeclaration(node: ESTree.ImportDeclaration) {
      const source = String(node.source.value);
      const isTarget = TARGET_PACKAGE_PATTERN.test(source);
      if (INSTRUMENTED_LIBRARY_PATTERN.test(source))
        facts.instrumentedLibraries.push(source);
      const list = isTarget ? facts.targetImports : facts.otherImports;
      if (node.specifiers.length === 0) {
        list.push({
          source,
          imported: "*side-effect*",
          local: "",
          line: lineOf(node),
        });
      }
      for (const spec of node.specifiers) {
        let imported: string;
        if (spec.type === "ImportDefaultSpecifier") imported = "default";
        else if (spec.type === "ImportNamespaceSpecifier") imported = "*";
        else
          imported =
            spec.imported.type === "Identifier"
              ? spec.imported.name
              : String(spec.imported.value);
        const fact: ImportFact = {
          source,
          imported,
          local: spec.local.name,
          line: lineOf(node),
        };
        list.push(fact);
        if (isTarget) bindings.set(spec.local.name, { source, imported });
      }
    },

    CallExpression(node: ESTree.CallExpression) {
      const callee = node.callee;
      // provider.shutdown() / provider.forceFlush()
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier"
      ) {
        const method = callee.property.name;
        if (method === "shutdown" || method === "forceFlush") {
          facts.flushCalls.push({
            text: sourceCode.getText(node),
            line: lineOf(node),
          });
        }
        if (method === "manuallyInstrument") facts.manuallyInstrumentCalls += 1;
        if (
          method === "on" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "process"
        ) {
          const event = literalString(node.arguments[0] as ESTree.Node);
          if (event) facts.processHandlers.push({ event, line: lineOf(node) });
        }
      }

      const resolved = resolveCallee(callee);
      if (!resolved) return;
      facts.targetCalls.push({
        name: resolved.name,
        source: resolved.source,
        node,
        line: lineOf(node),
        statementText: topLevelStatementText(node),
        callText: redactor.textOf(node),
        declaredKind: declaredKindOf(resolved.name, node),
        spanData: spanDataOf(resolved.name, node, redactor),
        registerOptions:
          resolved.name === "register" ? registerOptionsOf(node) : undefined,
      });
      if (resolved.name === "register") {
        const ancestors = sourceCode.getAncestors(node);
        const parent = ancestors[ancestors.length - 1];
        if (
          parent?.type === "VariableDeclarator" &&
          parent.id.type === "Identifier"
        ) {
          facts.registerResultNames.push(parent.id.name);
        }
      }
    },

    Property(node: ESTree.Property) {
      const key =
        node.key.type === "Identifier"
          ? node.key.name
          : literalString(node.key);
      if (
        (key === "hideInputs" ||
          key === "hideOutputs" ||
          key === "hideInputMessages" ||
          key === "hideOutputMessages") &&
        node.value.type === "Literal" &&
        node.value.value === true
      ) {
        facts.maskingConfigured = true;
      }
    },

    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
      for (const spec of node.specifiers) {
        if (spec.local.type === "Identifier")
          facts.exportedNames.push(spec.local.name);
      }
      const decl = node.declaration;
      if (decl?.type === "VariableDeclaration") {
        for (const d of decl.declarations) {
          if (d.id.type === "Identifier") facts.exportedNames.push(d.id.name);
        }
      } else if (decl && "id" in decl && decl.id?.type === "Identifier") {
        facts.exportedNames.push(decl.id.name);
      }
    },
  };

  return { visitor, finish: () => facts };
}

export function registerResultIsExported(facts: Facts): boolean {
  return facts.registerResultNames.some((n) => facts.exportedNames.includes(n));
}

export function usesTargetPackages(facts: Facts): boolean {
  return facts.targetImports.length > 0;
}
