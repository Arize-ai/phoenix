import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  readUIMessageStream,
  UIMessageStreamError,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import * as ts from "typescript/unstable/ast";
import { API } from "typescript/unstable/sync";

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type FixtureInput = {
  messageId: string;
  lastMessage: UIMessage | null;
  chunks: JsonValue[];
};

type FixtureError = {
  type: "UIMessageStreamError";
  chunkType: string;
  chunkId: string;
};

type Fixture = {
  upstreamTag: string;
  source: "upstream" | "phoenix";
  name: string;
  input: FixtureInput;
  writes: JsonValue[];
  throws?: FixtureError;
};

type ExtractedCase = {
  name: string;
  messageId: string;
  lastMessage: UIMessage | undefined;
  chunks: UIMessageChunk[];
};

const APP_DIRECTORY = resolve(process.cwd());
const REPOSITORY_DIRECTORY = resolve(APP_DIRECTORY, "..");
const FIXTURE_DIRECTORY = join(
  REPOSITORY_DIRECTORY,
  "tests",
  "unit",
  "server",
  "agents",
  "fixtures",
  "ui_message_stream"
);
const UPSTREAM_SOURCE_PATH = join(
  FIXTURE_DIRECTORY,
  "process-ui-message-stream.test.ts"
);
const FIXTURES_PATH = join(FIXTURE_DIRECTORY, "fixtures.json");
const EXPECTED_MINIMUM_UPSTREAM_CASES = 59;

const PHOENIX_CASES: ExtractedCase[] = [
  {
    name: "Phoenix custom chunks > durable error part and standard error",
    messageId: "phoenix-error-message",
    lastMessage: undefined,
    chunks: [
      { type: "start", messageId: "phoenix-error-message" },
      {
        type: "data-error",
        data: { errorText: "model failed" },
      },
      { type: "error", errorText: "model failed" },
    ],
  },
  {
    name: "Phoenix custom chunks > transient session and persistence events",
    messageId: "phoenix-transient-message",
    lastMessage: undefined,
    chunks: [
      { type: "start", messageId: "phoenix-transient-message" },
      {
        type: "data-session-summary",
        data: "A generated title",
        transient: true,
      },
      {
        type: "data-transcript-persisted",
        data: { messageId: "phoenix-transient-message" },
        transient: true,
      },
    ],
  },
  {
    name: "Phoenix protocol passthrough > abort and done do not change the message",
    messageId: "phoenix-passthrough-message",
    lastMessage: undefined,
    chunks: [
      { type: "start", messageId: "phoenix-passthrough-message" },
      { type: "abort", reason: "cancelled" },
      { type: "done" },
    ] as unknown as UIMessageChunk[],
  },
  {
    name: "Phoenix protocol coverage > source document",
    messageId: "phoenix-source-document-message",
    lastMessage: undefined,
    chunks: [
      {
        type: "source-document",
        sourceId: "document-1",
        mediaType: "text/plain",
        title: "Document",
        filename: "document.txt",
      },
    ],
  },
  {
    name: "Phoenix stream > interleaved preliminary subagent output",
    messageId: "phoenix-subagent-message",
    lastMessage: undefined,
    chunks: [
      { type: "start", messageId: "phoenix-subagent-message" },
      { type: "start-step" },
      {
        type: "tool-input-available",
        toolCallId: "call-subagent-1",
        toolName: "call_subagent",
        input: { name: "Phoenix data", task: "Summarize latency" },
      },
      {
        type: "tool-output-available",
        toolCallId: "call-subagent-1",
        output: {
          summary: "Working",
          message: {
            id: "subagent-1",
            role: "assistant",
            parts: [{ type: "text", text: "Working" }],
          },
        },
        preliminary: true,
      },
      { type: "text-start", id: "parent-text" },
      {
        type: "text-delta",
        id: "parent-text",
        delta: "Parent response",
      },
      { type: "text-end", id: "parent-text" },
      { type: "finish-step" },
    ],
  },
  {
    name: "Phoenix stream > forced skill step before model output",
    messageId: "phoenix-forced-skill-message",
    lastMessage: undefined,
    chunks: [
      { type: "start", messageId: "phoenix-forced-skill-message" },
      { type: "start-step" },
      {
        type: "tool-input-available",
        toolCallId: "load-skill-1",
        toolName: "load_skill",
        input: { name: "datasets" },
      },
      {
        type: "tool-output-available",
        toolCallId: "load-skill-1",
        output: "Dataset skill instructions",
      },
      { type: "finish-step" },
      { type: "start-step" },
      { type: "text-start", id: "model-text" },
      { type: "text-delta", id: "model-text", delta: "Done" },
      { type: "text-end", id: "model-text" },
      { type: "finish-step" },
    ],
  },
  {
    name: "Phoenix stream > typed assistant metadata",
    messageId: "phoenix-metadata-message",
    lastMessage: undefined,
    chunks: [
      { type: "start", messageId: "phoenix-metadata-message" },
      {
        type: "message-metadata",
        messageMetadata: {
          phoenix: {
            type: "assistant",
            sessionId: "session-1",
            usage: { requests: 1 },
          },
        },
      },
    ],
  },
  {
    name: "Phoenix stream > client tool continuation",
    messageId: "phoenix-continuation-message",
    lastMessage: {
      id: "phoenix-continuation-message",
      role: "assistant",
      parts: [
        {
          type: "tool-client_action",
          toolCallId: "client-tool-1",
          state: "input-available",
          input: { value: "before" },
        },
      ],
    },
    chunks: [
      { type: "start", messageId: "phoenix-continuation-message" },
      {
        type: "tool-output-available",
        toolCallId: "client-tool-1",
        output: { status: "accepted" },
      },
      { type: "start-step" },
      { type: "text-start", id: "continuation-text" },
      {
        type: "text-delta",
        id: "continuation-text",
        delta: "Continued",
      },
      { type: "text-end", id: "continuation-text" },
      { type: "finish-step" },
    ],
  },
];

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function getPropertyName({
  node,
  sourceFile,
  caseName,
}: {
  node: ts.PropertyName;
  sourceFile: ts.SourceFile;
  caseName: string;
}): string {
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  ) {
    return node.text;
  }
  throw new Error(
    `${caseName}: unsupported property name ${node.getText(sourceFile)}`
  );
}

function evaluateLiteral({
  node,
  sourceFile,
  caseName,
}: {
  node: ts.Expression;
  sourceFile: ts.SourceFile;
  caseName: string;
}): unknown {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (ts.isIdentifier(node) && node.text === "undefined") {
    return undefined;
  }
  if (ts.isPrefixUnaryExpression(node)) {
    const operand = evaluateLiteral({
      node: node.operand,
      sourceFile,
      caseName,
    });
    if (typeof operand !== "number") {
      throw new Error(`${caseName}: unary operator requires a numeric literal`);
    }
    if (node.operator === ts.SyntaxKind.MinusToken) {
      return -operand;
    }
    if (node.operator === ts.SyntaxKind.PlusToken) {
      return operand;
    }
  }
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return evaluateLiteral({
      node: node.expression,
      sourceFile,
      caseName,
    });
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => {
      if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) {
        throw new Error(
          `${caseName}: array spreads and omitted values are not literals`
        );
      }
      return evaluateLiteral({ node: element, sourceFile, caseName });
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    const result: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(
          `${caseName}: unsupported object member ${property.getText(sourceFile)}`
        );
      }
      const name = getPropertyName({
        node: property.name,
        sourceFile,
        caseName,
      });
      result[name] = evaluateLiteral({
        node: property.initializer,
        sourceFile,
        caseName,
      });
    }
    return result;
  }
  throw new Error(
    `${caseName}: non-literal expression ${node.getText(sourceFile)}`
  );
}

function findCalls({
  root,
  functionName,
}: {
  root: ts.Node;
  functionName: string;
}): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === functionName
    ) {
      calls.push(node);
    }
    node.forEachChild(visit);
  };
  visit(root);
  return calls;
}

function getContainingFunction({
  node,
  sourceFile,
}: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
}): ts.FunctionLikeDeclaration {
  let parent: ts.Node | undefined = node.parent;
  while (parent != null) {
    if (
      ts.isArrowFunction(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isFunctionDeclaration(parent)
    ) {
      return parent;
    }
    parent = parent.parent;
  }
  throw new Error(
    `No containing function for ${node.getText(sourceFile).slice(0, 80)}`
  );
}

function getCaseName({
  node,
  sourceFile,
}: {
  node: ts.Node;
  sourceFile: ts.SourceFile;
}): string {
  const names: string[] = [];
  let parent: ts.Node | undefined = node;
  while (parent != null) {
    if (
      ts.isCallExpression(parent) &&
      ts.isIdentifier(parent.expression) &&
      ["describe", "it", "test"].includes(parent.expression.text)
    ) {
      const [name] = parent.arguments;
      if (name == null || !ts.isStringLiteral(name)) {
        throw new Error(
          `Non-literal test name around ${node.getText(sourceFile).slice(0, 80)}`
        );
      }
      names.unshift(name.text);
    }
    parent = parent.parent;
  }
  return names.join(" > ");
}

function extractCases({
  sourceFile,
}: {
  sourceFile: ts.SourceFile;
}): ExtractedCase[] {
  const streamCalls = findCalls({
    root: sourceFile,
    functionName: "createUIMessageStream",
  });
  if (streamCalls.length < EXPECTED_MINIMUM_UPSTREAM_CASES) {
    throw new Error(
      `Extracted ${streamCalls.length} upstream cases; expected at least ${EXPECTED_MINIMUM_UPSTREAM_CASES}`
    );
  }

  const names = new Set<string>();
  return streamCalls.map((streamCall) => {
    const caseName = getCaseName({ node: streamCall, sourceFile });
    if (!caseName || names.has(caseName)) {
      throw new Error(`Missing or duplicate upstream case name: ${caseName}`);
    }
    names.add(caseName);

    const containingFunction = getContainingFunction({
      node: streamCall,
      sourceFile,
    });
    const stateCalls = findCalls({
      root: containingFunction,
      functionName: "createStreamingUIMessageState",
    });
    if (stateCalls.length !== 1) {
      throw new Error(
        `${caseName}: found ${stateCalls.length} state constructors; expected exactly one`
      );
    }

    const [chunksExpression] = streamCall.arguments;
    const [stateExpression] = stateCalls[0].arguments;
    if (chunksExpression == null || stateExpression == null) {
      throw new Error(`${caseName}: missing stream or state arguments`);
    }

    const chunks = evaluateLiteral({
      node: chunksExpression,
      sourceFile,
      caseName,
    });
    const state = evaluateLiteral({
      node: stateExpression,
      sourceFile,
      caseName,
    });
    if (!Array.isArray(chunks)) {
      throw new Error(`${caseName}: stream chunks must be an array literal`);
    }
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      throw new Error(`${caseName}: state options must be an object literal`);
    }

    const stateOptions = state as Record<string, unknown>;
    if (typeof stateOptions.messageId !== "string") {
      throw new Error(`${caseName}: messageId must be a string literal`);
    }
    const lastMessage = stateOptions.lastMessage;
    if (
      lastMessage !== undefined &&
      (typeof lastMessage !== "object" ||
        lastMessage === null ||
        Array.isArray(lastMessage))
    ) {
      throw new Error(
        `${caseName}: lastMessage must be an object or undefined`
      );
    }

    return {
      name: caseName,
      messageId: stateOptions.messageId,
      lastMessage: lastMessage as UIMessage | undefined,
      chunks: chunks as UIMessageChunk[],
    };
  });
}

function createChunkStream(
  chunks: UIMessageChunk[]
): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(structuredClone(chunk));
      }
      controller.close();
    },
  });
}

async function generateFixture({
  extractedCase,
  source,
  upstreamTag,
}: {
  extractedCase: ExtractedCase;
  source: Fixture["source"];
  upstreamTag: string;
}): Promise<Fixture> {
  const writes: JsonValue[] = [];
  let streamError: UIMessageStreamError | undefined;
  const message =
    extractedCase.lastMessage ??
    ({
      id: extractedCase.messageId,
      role: "user",
      parts: [],
    } satisfies UIMessage);

  const stream = readUIMessageStream({
    message: structuredClone(message),
    stream: createChunkStream(extractedCase.chunks),
    onError(error) {
      if (error instanceof UIMessageStreamError) {
        streamError = error;
      }
    },
  });
  for await (const messageSnapshot of stream) {
    const jsonSnapshot = JSON.parse(JSON.stringify(messageSnapshot)) as unknown;
    if (!isJsonValue(jsonSnapshot)) {
      throw new Error(`${extractedCase.name}: generated a non-JSON message`);
    }
    writes.push(jsonSnapshot);
  }

  const fixture: Fixture = {
    upstreamTag,
    source,
    name: extractedCase.name,
    input: {
      messageId: extractedCase.messageId,
      lastMessage: extractedCase.lastMessage
        ? structuredClone(extractedCase.lastMessage)
        : null,
      chunks: extractedCase.chunks.map((chunk) => {
        const jsonChunk = JSON.parse(JSON.stringify(chunk)) as unknown;
        if (!isJsonValue(jsonChunk)) {
          throw new Error(`${extractedCase.name}: chunk is not JSON`);
        }
        return jsonChunk;
      }),
    },
    writes,
  };
  if (streamError != null) {
    fixture.throws = {
      type: "UIMessageStreamError",
      chunkType: streamError.chunkType,
      chunkId: streamError.chunkId,
    };
  }
  return fixture;
}

async function getSourceFile({
  filePath,
}: {
  filePath: string;
}): Promise<ts.SourceFile> {
  const api = new API({ cwd: APP_DIRECTORY });
  try {
    const snapshot = api.updateSnapshot({ openFiles: [filePath] });
    const project = snapshot.getDefaultProjectForFile(filePath);
    const sourceFile = project?.program.getSourceFile(filePath);
    if (sourceFile == null) {
      throw new Error(`TypeScript could not parse ${filePath}`);
    }
    return sourceFile;
  } finally {
    api.close();
  }
}

async function main(): Promise<void> {
  const aiPackage = JSON.parse(
    await readFile(join(APP_DIRECTORY, "node_modules", "ai", "package.json"), {
      encoding: "utf8",
    })
  ) as { version?: unknown };
  if (typeof aiPackage.version !== "string") {
    throw new Error("Could not resolve the installed ai package version");
  }
  const upstreamTag = `ai@${aiPackage.version}`;
  const upstreamUrl =
    `https://raw.githubusercontent.com/vercel/ai/` +
    `${encodeURIComponent(upstreamTag)}/packages/ai/src/ui/` +
    `process-ui-message-stream.test.ts`;
  const response = await fetch(upstreamUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${upstreamUrl}: ${response.status} ${response.statusText}`
    );
  }
  const upstreamSource = await response.text();
  await writeFile(UPSTREAM_SOURCE_PATH, upstreamSource, { encoding: "utf8" });

  const sourceFile = await getSourceFile({ filePath: UPSTREAM_SOURCE_PATH });
  const upstreamCases = extractCases({ sourceFile });
  const fixtures = await Promise.all([
    ...upstreamCases.map((extractedCase) =>
      generateFixture({
        extractedCase,
        source: "upstream",
        upstreamTag,
      })
    ),
    ...PHOENIX_CASES.map((extractedCase) =>
      generateFixture({
        extractedCase,
        source: "phoenix",
        upstreamTag,
      })
    ),
  ]);
  await writeFile(FIXTURES_PATH, `${JSON.stringify(fixtures, null, 2)}\n`, {
    encoding: "utf8",
  });
  process.stdout.write(
    `Generated ${upstreamCases.length} upstream and ${PHOENIX_CASES.length} ` +
      `Phoenix fixtures for ${upstreamTag}\n`
  );
}

void main();
