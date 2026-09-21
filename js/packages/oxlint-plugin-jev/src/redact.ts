/**
 * Redacts literal values from source text before it is sent to jev.
 *
 * The lint question is about *what flows* into spans and *how* the SDK is
 * used, which lives in identifiers, member expressions, property keys and
 * call shapes. Literal values carry almost none of that signal but are
 * exactly where a real API key, a patient name or a test SSN would sit. So:
 *
 *   - every string literal value  → "<str:N>"   (N = original length)
 *   - every template-literal quasi → <str:N>     (the `${expr}` parts are kept)
 *   - numeric literals with ≥ 7 digits → <num:N> (card numbers, SSNs, ids)
 *
 * Kept, because they are structural rather than data: object property keys,
 * import/export sources, directives, computed member keys, type-level
 * literals, and the values of the `kind` / `name` / `type` span options.
 */
import type * as ESTree from "estree";

import type { SourceCode } from "./oxlintTypes.js";

export type RedactPolicy = "all" | "off";

const KEEP_OPTION_VALUES = new Set(["kind", "name", "type"]);
const LONG_NUMBER_DIGITS = 7;
const SKIP_KEYS = new Set(["parent", "loc", "range", "start", "end"]);

interface Replacement {
  start: number;
  end: number;
  text: string;
}

type AnyNode = ESTree.Node & { range?: [number, number]; raw?: string };

function isNode(value: unknown): value is AnyNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function walk(
  node: AnyNode,
  parent: AnyNode | undefined,
  visit: (n: AnyNode, p: AnyNode | undefined) => void
): void {
  visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, node, visit);
    } else if (isNode(value)) {
      walk(value, node, visit);
    }
  }
}

function propertyKeyName(prop: ESTree.Property): string | undefined {
  if (prop.computed) return undefined;
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal" && typeof prop.key.value === "string")
    return prop.key.value;
  return undefined;
}

function isStructuralString(
  node: AnyNode,
  parent: AnyNode | undefined
): boolean {
  if (!parent) return false;
  const parentType: string = parent.type;
  // Type-level literals (`type K = "a" | "b"`) and import attributes are structure, not data.
  if (parentType.startsWith("TS") || parentType === "ImportAttribute")
    return true;
  switch (parent.type) {
    case "Property": {
      if (parent.key === node && !parent.computed) return true;
      if (parent.value === node) {
        const key = propertyKeyName(parent);
        return key !== undefined && KEEP_OPTION_VALUES.has(key);
      }
      return false;
    }
    case "ImportDeclaration":
    case "ExportAllDeclaration":
      return parent.source === node;
    case "ExportNamedDeclaration":
      return parent.source === node;
    case "ImportExpression":
      return parent.source === node;
    case "ExpressionStatement":
      return typeof (parent as { directive?: string }).directive === "string";
    case "MemberExpression":
      return parent.computed && parent.property === node;
    default:
      return false;
  }
}

export class Redactor {
  private readonly replacements: Replacement[] = [];
  readonly redactions: number;

  constructor(
    private readonly sourceCode: SourceCode,
    readonly policy: RedactPolicy
  ) {
    if (policy !== "off") this.collect();
    this.redactions = this.replacements.length;
    this.replacements.sort((a, b) => a.start - b.start);
  }

  private collect(): void {
    const src = this.sourceCode.text;
    walk(this.sourceCode.ast as AnyNode, undefined, (node, parent) => {
      if (node.type === "Literal" && node.range) {
        const [start, end] = node.range;
        if (typeof node.value === "string") {
          if (isStructuralString(node, parent)) return;
          this.replacements.push({
            start,
            end,
            text: `"<str:${node.value.length}>"`,
          });
        } else if (
          typeof node.value === "number" ||
          typeof node.value === "bigint"
        ) {
          const digits = String(node.raw ?? node.value).replace(
            /\D/g,
            ""
          ).length;
          if (digits >= LONG_NUMBER_DIGITS)
            this.replacements.push({ start, end, text: `<num:${digits}>` });
        }
      } else if (node.type === "TemplateLiteral") {
        for (const quasi of node.quasis) {
          const q = quasi as AnyNode;
          const raw = quasi.value.raw;
          if (!raw || !q.range) continue;
          // The quasi range includes its delimiters (` or }` and ${ or `); locate the raw text inside.
          const slice = src.slice(q.range[0], q.range[1]);
          const offset = slice.indexOf(raw);
          if (offset < 0) continue;
          const start = q.range[0] + offset;
          this.replacements.push({
            start,
            end: start + raw.length,
            text: `<str:${raw.length}>`,
          });
        }
      }
    });
  }

  /** Redacted text of the whole file. */
  text(): string {
    return this.textOfRange(0, this.sourceCode.text.length);
  }

  /** Redacted text of one node. */
  textOf(node: ESTree.Node): string {
    const range = (node as AnyNode).range;
    if (!range) return this.sourceCode.getText(node);
    return this.textOfRange(range[0], range[1]);
  }

  private textOfRange(start: number, end: number): string {
    const src = this.sourceCode.text;
    let out = "";
    let cursor = start;
    for (const r of this.replacements) {
      if (r.end <= start) continue;
      if (r.start >= end) break;
      out += src.slice(cursor, Math.max(cursor, r.start)) + r.text;
      cursor = Math.min(end, r.end);
    }
    return out + src.slice(cursor, end);
  }
}

export const REDACTION_NOTE =
  "String literal values are replaced by <str:N> placeholders (N = original length) and long numbers by <num:N>; property keys, import sources and span kind/name values are kept. Placeholders are redactions, not the real content.";
