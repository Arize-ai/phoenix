import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";

import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSourceGrain,
} from "@phoenix/types";

const PYTHON_INDENT = "    ";
const TYPESCRIPT_INDENT = "  ";

/**
 * Returns the default placeholder source code for a new code evaluator.
 * The placeholder shows the full `{score, label, explanation}` return
 * shape alongside the bare shorthands (number → score, string → label).
 *
 * A dataset example carries a `reference` beside the three every evaluator
 * receives; a span or a session does not, and its footer declares no
 * `EvaluatorParams` to annotate against — so the project grains open on the
 * three names they are actually handed, unannotated.
 */
export function getDefaultCodeEvaluatorSource(
  language: CodeEvaluatorLanguage,
  grain: EvaluatorMappingSourceGrain
): string {
  const isDataset = grain === "dataset";
  if (language === "PYTHON") {
    const parameters = isDataset
      ? "output, reference=None, input=None, metadata=None"
      : "input=None, output=None, metadata=None";
    return `def evaluate(${parameters}):
${PYTHON_INDENT}# return 1.0     # numbers are recorded as scores
${PYTHON_INDENT}# return "pass"  # strings are recorded as labels
${PYTHON_INDENT}return {"score": 1.0, "label": "pass", "explanation": "..."}
`;
  }
  // TYPESCRIPT
  const signature = isDataset
    ? "{ output, reference, input, metadata }: EvaluatorParams"
    : "{ input, output, metadata }";
  return `function evaluate(${signature}) {
${TYPESCRIPT_INDENT}// return 1;        // numbers are recorded as scores
${TYPESCRIPT_INDENT}// return "pass";   // strings are recorded as labels
${TYPESCRIPT_INDENT}return { score: 1, label: "pass", explanation: "..." };
}
`;
}

export const extractCodeEvaluatorVariables = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}): string[] => {
  const state = createCodeEvaluatorEditorState({ language, sourceCode });
  return extractCodeEvaluatorVariablesFromState({ language, state });
};

export const extractRequiredCodeEvaluatorVariables = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}): string[] => {
  const state = createCodeEvaluatorEditorState({ language, sourceCode });
  return extractCodeEvaluatorVariableDefinitions({ language, state })
    .filter(({ isRequired }) => isRequired)
    .map(({ name }) => name);
};

export function extractCodeEvaluatorVariablesFromState({
  language,
  state,
}: {
  language: CodeEvaluatorLanguage;
  state: EditorState;
}): string[] {
  return extractCodeEvaluatorVariableDefinitions({ language, state }).map(
    ({ name }) => name
  );
}

/** Where in the `evaluate` declaration a completion is being asked for. */
type CodeEvaluatorCompletionPosition = "signature" | "body" | null;

/**
 * Locates the cursor in the top-level `evaluate` declaration CodeMirror parsed.
 *
 * @param params - editor position inputs
 * @param params.language - evaluator source language
 * @param params.state - current CodeMirror state
 * @param params.pos - cursor offset in the document
 */
export function getCodeEvaluatorCompletionPosition({
  language,
  state,
  pos,
}: {
  language: CodeEvaluatorLanguage;
  state: EditorState;
  pos: number;
}): CodeEvaluatorCompletionPosition {
  const definition = getCodeEvaluatorDefinition({ language, state });
  if (definition === null) {
    return null;
  }

  const nodeAtCursor = syntaxTree(state).resolveInner(pos, -1);
  if (hasAncestor({ node: nodeAtCursor, ancestor: definition.paramList })) {
    return "signature";
  }

  if (
    definition.body !== null &&
    hasAncestor({ node: nodeAtCursor, ancestor: definition.body })
  ) {
    return "body";
  }
  if (
    definition.arrowFunction !== null &&
    hasAncestor({ node: nodeAtCursor, ancestor: definition.arrowFunction }) &&
    pos >= definition.paramList.to
  ) {
    return "body";
  }
  return null;
}

/**
 * The parameter name the cursor is writing, and how it has to be written.
 *
 * A completion at the signature replaces this range rather than the text
 * behind the cursor, so a name edited from the middle is rewritten whole
 * instead of being doubled.
 */
export type CodeEvaluatorSignatureNameSlot = {
  from: number;
  to: number;
  /**
   * Whether the name has to be wrapped in a destructure. A TypeScript
   * evaluator is handed one object, so a parameter list that has not opened
   * one yet grows it around the name being written.
   */
  requiresDestructure: boolean;
};

/**
 * The name slot the cursor sits in, or null where the signature is not naming
 * a parameter — inside a default value, an annotation, or a variadic, none of
 * which bind one of the evaluator's inputs.
 *
 * @param params - editor position inputs
 * @param params.language - evaluator source language
 * @param params.state - current CodeMirror state
 * @param params.pos - cursor offset in the document
 */
export function getCodeEvaluatorSignatureNameSlot({
  language,
  state,
  pos,
}: {
  language: CodeEvaluatorLanguage;
  state: EditorState;
  pos: number;
}): CodeEvaluatorSignatureNameSlot | null {
  const definition = getCodeEvaluatorDefinition({ language, state });
  if (definition === null) {
    return null;
  }
  if (language === "PYTHON") {
    return getPythonNameSlot({ state, paramList: definition.paramList, pos });
  }
  return definition.objectPattern === null
    ? getTypeScriptParameterNameSlot({
        state,
        paramList: definition.paramList,
        pos,
      })
    : getTypeScriptPatternNameSlot({
        state,
        objectPattern: definition.objectPattern,
        pos,
      });
}

/** One comma-separated slot of a parameter list or destructure. */
type ParameterSegment = {
  from: number;
  to: number;
  children: CodeEvaluatorSyntaxNode[];
};

/** The slot `pos` sits in, brackets and separators excluded. */
function findParameterSegment({
  parent,
  pos,
}: {
  parent: CodeEvaluatorSyntaxNode;
  pos: number;
}): ParameterSegment | null {
  const segments: ParameterSegment[] = [];
  let from = parent.from;
  let children: CodeEvaluatorSyntaxNode[] = [];
  let isClosed = false;
  for (const child of getDirectChildren(parent)) {
    if (child.name === "(" || child.name === "{") {
      from = child.to;
      children = [];
    } else if (child.name === ",") {
      segments.push({ from, to: child.from, children });
      from = child.to;
      children = [];
    } else if (child.name === ")" || child.name === "}") {
      segments.push({ from, to: child.from, children });
      isClosed = true;
      break;
    } else {
      children.push(child);
    }
  }
  if (!isClosed) {
    segments.push({ from, to: parent.to, children });
  }
  return (
    segments.find((segment) => segment.from <= pos && pos <= segment.to) ?? null
  );
}

function getPythonNameSlot({
  state,
  paramList,
  pos,
}: {
  state: EditorState;
  paramList: CodeEvaluatorSyntaxNode;
  pos: number;
}): CodeEvaluatorSignatureNameSlot | null {
  const segment = findParameterSegment({ parent: paramList, pos });
  if (segment === null) {
    return null;
  }
  // A variadic gathers whatever is left over instead of binding one of the
  // evaluator's inputs, so its name is not a slot a row can fill.
  if (segment.children.some(({ name }) => name === "*" || name === "**")) {
    return null;
  }
  const trailing = segment.children.find(
    ({ name }) => name === "TypeDef" || name === "AssignOp"
  );
  return toNameSlot({
    state,
    from: segment.from,
    to: trailing?.from ?? segment.to,
    pos,
    requiresDestructure: false,
  });
}

function getTypeScriptPatternNameSlot({
  state,
  objectPattern,
  pos,
}: {
  state: EditorState;
  objectPattern: CodeEvaluatorSyntaxNode;
  pos: number;
}): CodeEvaluatorSignatureNameSlot | null {
  const segment = findParameterSegment({ parent: objectPattern, pos });
  if (segment === null) {
    return null;
  }
  const property = segment.children.find(
    ({ name }) => name === "PatternProperty"
  );
  if (property === undefined) {
    return toNameSlot({
      state,
      from: segment.from,
      to: segment.to,
      pos,
      requiresDestructure: false,
    });
  }
  if (findDirectChild({ parent: property, name: "Spread" }) !== null) {
    return null;
  }
  // The key is what binds an input; a rename or a default sits beside it and
  // names nothing the evaluator is handed.
  const propertyName = findDirectChild({
    parent: property,
    name: "PropertyName",
  });
  return propertyName === null
    ? null
    : toNameSlot({
        state,
        from: propertyName.from,
        to: propertyName.to,
        pos,
        requiresDestructure: false,
      });
}

function getTypeScriptParameterNameSlot({
  state,
  paramList,
  pos,
}: {
  state: EditorState;
  paramList: CodeEvaluatorSyntaxNode;
  pos: number;
}): CodeEvaluatorSignatureNameSlot | null {
  const segment = findParameterSegment({ parent: paramList, pos });
  if (segment === null) {
    return null;
  }
  if (segment.children.some(({ name }) => name === "Spread")) {
    return null;
  }
  const annotation = segment.children.find(
    ({ name }) => name === "TypeAnnotation"
  );
  return toNameSlot({
    state,
    from: segment.from,
    to: annotation?.from ?? segment.to,
    pos,
    requiresDestructure: true,
  });
}

/** The slot's name text, less the whitespace the author left around it. */
function toNameSlot({
  state,
  from,
  to,
  pos,
  requiresDestructure,
}: {
  state: EditorState;
  from: number;
  to: number;
  pos: number;
  requiresDestructure: boolean;
}): CodeEvaluatorSignatureNameSlot | null {
  if (from > to || pos < from || pos > to) {
    return null;
  }
  const text = state.doc.sliceString(from, to);
  if (text.trim() === "") {
    return { from: pos, to: pos, requiresDestructure };
  }
  const start = from + (text.length - text.trimStart().length);
  const end = to - (text.length - text.trimEnd().length);
  return pos < start || pos > end
    ? null
    : { from: start, to: end, requiresDestructure };
}

type CodeEvaluatorVariableDefinition = {
  name: string;
  isRequired: boolean;
};

function extractCodeEvaluatorVariableDefinitions({
  language,
  state,
}: {
  language: CodeEvaluatorLanguage;
  state: EditorState;
}): CodeEvaluatorVariableDefinition[] {
  const definition = getCodeEvaluatorDefinition({ language, state });
  if (definition === null) {
    return [];
  }
  return language === "PYTHON"
    ? extractPythonVariables({ state, paramList: definition.paramList })
    : extractTypeScriptVariables({
        state,
        objectPattern: definition.objectPattern,
      });
}

type CodeEvaluatorSyntaxNode = ReturnType<typeof syntaxTree>["topNode"];

type CodeEvaluatorDefinition = {
  paramList: CodeEvaluatorSyntaxNode;
  objectPattern: CodeEvaluatorSyntaxNode | null;
  body: CodeEvaluatorSyntaxNode | null;
  arrowFunction: CodeEvaluatorSyntaxNode | null;
};

function createCodeEvaluatorEditorState({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}): EditorState {
  return EditorState.create({
    doc: sourceCode,
    extensions: [
      language === "PYTHON" ? python() : javascript({ typescript: true }),
    ],
  });
}

function getCodeEvaluatorDefinition({
  language,
  state,
}: {
  language: CodeEvaluatorLanguage;
  state: EditorState;
}): CodeEvaluatorDefinition | null {
  const topNode = syntaxTree(state).topNode;
  for (const declaration of getDirectChildren(topNode)) {
    if (language === "PYTHON" && declaration.name === "FunctionDefinition") {
      const nameNode = findDirectChild({
        parent: declaration,
        name: "VariableName",
      });
      const paramList = findDirectChild({
        parent: declaration,
        name: "ParamList",
      });
      if (
        nameNode !== null &&
        getNodeText({ state, node: nameNode }) === "evaluate" &&
        paramList !== null
      ) {
        return {
          paramList,
          objectPattern: null,
          body: findDirectChild({ parent: declaration, name: "Body" }),
          arrowFunction: null,
        };
      }
    }

    if (
      language === "TYPESCRIPT" &&
      declaration.name === "FunctionDeclaration"
    ) {
      const nameNode = findDirectChild({
        parent: declaration,
        name: "VariableDefinition",
      });
      const paramList = findDirectChild({
        parent: declaration,
        name: "ParamList",
      });
      const objectPattern =
        paramList === null
          ? null
          : findDirectChild({ parent: paramList, name: "ObjectPattern" });
      if (
        nameNode !== null &&
        getNodeText({ state, node: nameNode }) === "evaluate" &&
        paramList !== null
      ) {
        return {
          paramList,
          objectPattern,
          body: findDirectChild({ parent: declaration, name: "Block" }),
          arrowFunction: null,
        };
      }
    }

    if (
      language === "TYPESCRIPT" &&
      declaration.name === "VariableDeclaration"
    ) {
      const nameNode = findDirectChild({
        parent: declaration,
        name: "VariableDefinition",
      });
      const arrowFunction = findDirectChild({
        parent: declaration,
        name: "ArrowFunction",
      });
      const paramList =
        arrowFunction === null
          ? null
          : findDirectChild({ parent: arrowFunction, name: "ParamList" });
      const objectPattern =
        paramList === null
          ? null
          : findDirectChild({ parent: paramList, name: "ObjectPattern" });
      if (
        nameNode !== null &&
        getNodeText({ state, node: nameNode }) === "evaluate" &&
        arrowFunction !== null &&
        paramList !== null
      ) {
        return {
          paramList,
          objectPattern,
          body: findDirectChild({ parent: arrowFunction, name: "Block" }),
          arrowFunction,
        };
      }
    }
  }
  return null;
}

function extractPythonVariables({
  state,
  paramList,
}: {
  state: EditorState;
  paramList: CodeEvaluatorSyntaxNode;
}): CodeEvaluatorVariableDefinition[] {
  return getDirectChildren(paramList)
    .filter((node) => node.name === "VariableName")
    .map((node) => {
      const segmentStart = findPreviousParameterBoundary(node);
      const segmentEnd = findNextParameterBoundary(node);
      const prefix = state.doc.sliceString(segmentStart, node.from).trim();
      const segment = state.doc.sliceString(segmentStart, segmentEnd);
      return {
        name: getNodeText({ state, node }),
        isRequired: !prefix.startsWith("*") && !segment.includes("="),
        isVariadic: prefix.startsWith("*"),
      };
    })
    .filter(({ name, isVariadic }) => Boolean(name) && !isVariadic)
    .map(({ name, isRequired }) => ({ name, isRequired }))
    .filter(uniqueDefinition);
}

function extractTypeScriptVariables({
  state,
  objectPattern,
}: {
  state: EditorState;
  objectPattern: CodeEvaluatorSyntaxNode | null;
}): CodeEvaluatorVariableDefinition[] {
  if (objectPattern === null) {
    return [];
  }
  return getDirectChildren(objectPattern)
    .filter((node) => node.name === "PatternProperty")
    .map((property) =>
      findDirectChild({ parent: property, name: "PropertyName" })
    )
    .filter((node): node is CodeEvaluatorSyntaxNode => node !== null)
    .map((node) => ({
      name: getNodeText({ state, node }),
      // TypeScript evaluators receive one object, so destructured keys can be
      // absent without preventing the evaluator call.
      isRequired: false,
    }))
    .filter(({ name }) => Boolean(name))
    .filter(uniqueDefinition);
}

function getDirectChildren(
  parent: CodeEvaluatorSyntaxNode
): CodeEvaluatorSyntaxNode[] {
  const children: CodeEvaluatorSyntaxNode[] = [];
  for (
    let child = parent.firstChild;
    child !== null;
    child = child.nextSibling
  ) {
    children.push(child);
  }
  return children;
}

function findDirectChild({
  parent,
  name,
}: {
  parent: CodeEvaluatorSyntaxNode;
  name: string;
}): CodeEvaluatorSyntaxNode | null {
  return getDirectChildren(parent).find((child) => child.name === name) ?? null;
}

function findPreviousParameterBoundary(node: CodeEvaluatorSyntaxNode): number {
  for (
    let sibling = node.prevSibling;
    sibling !== null;
    sibling = sibling.prevSibling
  ) {
    if (sibling.name === "," || sibling.name === "(") {
      return sibling.to;
    }
  }
  return node.parent?.from ?? 0;
}

function findNextParameterBoundary(node: CodeEvaluatorSyntaxNode): number {
  for (
    let sibling = node.nextSibling;
    sibling !== null;
    sibling = sibling.nextSibling
  ) {
    if (sibling.name === "," || sibling.name === ")") {
      return sibling.from;
    }
  }
  return node.parent?.to ?? node.to;
}

function getNodeText({
  state,
  node,
}: {
  state: EditorState;
  node: CodeEvaluatorSyntaxNode;
}): string {
  return state.doc.sliceString(node.from, node.to);
}

function hasAncestor({
  node,
  ancestor,
}: {
  node: CodeEvaluatorSyntaxNode;
  ancestor: CodeEvaluatorSyntaxNode;
}): boolean {
  for (
    let current: CodeEvaluatorSyntaxNode | null = node;
    current !== null;
    current = current.parent
  ) {
    if (
      current.name === ancestor.name &&
      current.from === ancestor.from &&
      current.to === ancestor.to
    ) {
      return true;
    }
  }
  return false;
}

function uniqueDefinition(
  definition: CodeEvaluatorVariableDefinition,
  index: number,
  definitions: CodeEvaluatorVariableDefinition[]
) {
  return (
    definitions.findIndex(({ name }) => name === definition.name) === index
  );
}
