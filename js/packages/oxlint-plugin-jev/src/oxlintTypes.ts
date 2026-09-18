/**
 * Minimal structural types for the subset of oxlint's ESLint-compatible JS
 * plugin API this package uses. oxlint (1.79) only exports `RuleTester` from
 * `oxlint/plugins-dev`, so the plugin surface is described here instead.
 */
import type * as ESTree from "estree";

export interface SourceCode {
  readonly text: string;
  readonly ast: ESTree.Program;
  getText(node?: ESTree.Node | null): string;
  getAncestors(node: ESTree.Node): ESTree.Node[];
}

export interface DiagnosticData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface Diagnostic {
  node?: ESTree.Node;
  loc?: { line: number; column: number };
  message?: string;
  messageId?: string;
  data?: DiagnosticData;
}

export interface RuleContext {
  readonly id: string;
  readonly filename: string;
  readonly physicalFilename: string;
  readonly cwd: string;
  readonly options: readonly unknown[];
  readonly settings: Record<string, unknown>;
  readonly sourceCode: SourceCode;
  report(diagnostic: Diagnostic): void;
}

// Visitor keys are ESTree node types plus `:exit` variants; oxlint validates
// them at runtime, so keep the value type loose here.
// eslint-disable-next-line typescript/no-explicit-any
export type Visitor = Record<string, (node: any) => void>;

export interface RuleMeta {
  type?: "problem" | "suggestion" | "layout";
  docs?: { description?: string; url?: string };
  schema?: unknown[];
  messages?: Record<string, string>;
}

export interface Rule {
  meta?: RuleMeta;
  create(context: RuleContext): Visitor;
}

export interface Plugin {
  meta: { name: string; version?: string };
  rules: Record<string, Rule>;
}
