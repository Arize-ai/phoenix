import type { ProjectEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSessionEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";

import {
  isEvaluatorPathContainer,
  resolveEvaluatorPath,
} from "../evaluatorPathCompletions";
import {
  CURATED_EVALUATOR_PATH_IDEAS,
  F_STRING_PATH_SYNTAX,
  getEvaluatorPathIdeas,
  MAPPING_PATH_SYNTAX,
} from "../evaluatorPathIdeas";

/** An LLM span as the server's span-to-example conversion builds it. */
const LLM_TOOL_SPAN: Record<string, unknown> = {
  input: {
    messages: [
      { role: "system", content: "Answer with the weather tool." },
      { role: "user", content: "What's the weather in Paris?" },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Current weather for a city",
          parameters: { type: "object", properties: { city: {} } },
        },
      },
    ],
  },
  output: {
    messages: [
      {
        role: "assistant",
        content: "Checking the weather.",
        tool_calls: [
          { function: { name: "get_weather", arguments: { city: "Paris" } } },
        ],
      },
    ],
  },
  metadata: {
    span_id: "7f3b1c9a2d5e4081",
    span_kind: "LLM",
    latency_ms: 812.4,
    attributes: {},
    events: [],
    annotations: {},
  },
};

const RETRIEVER_SPAN: Record<string, unknown> = {
  input: { input: "How do I rotate my API key?" },
  output: {
    documents: [
      { id: "doc-1", content: "Create a second key first.", score: 0.92 },
      {
        id: "doc-2",
        content: "Revoke the old key once traffic drains.",
        score: 0.81,
      },
    ],
  },
  metadata: {
    span_id: "a361f90f84cb27fc",
    span_kind: "RETRIEVER",
    events: [],
    annotations: {},
  },
};

const TWO_TURN_SESSION = getSampleSessionEvaluationContext().context as Record<
  string,
  unknown
>;

const FOUR_TURN_SESSION: Record<string, unknown> = {
  input: "Hi",
  output: "Done.",
  metadata: {
    session_id: "s-4",
    first_input: "Hi",
    last_output: "Done.",
    turns: [
      { input: "Hi", output: "Hello!", metadata: {}, span_id: "1" },
      {
        input: "Reset my key",
        output: "Which key?",
        metadata: {},
        span_id: "2",
      },
      { input: "The API key", output: "Rotated.", metadata: {}, span_id: "3" },
      { input: "Thanks", output: "Done.", metadata: {}, span_id: "4" },
    ],
  },
};

const RECORDS: {
  name: string;
  recordKind: ProjectEvaluatorRecordKind;
  source: Record<string, unknown>;
}[] = [
  { name: "LLM span with tools", recordKind: "span", source: LLM_TOOL_SPAN },
  { name: "retriever span", recordKind: "span", source: RETRIEVER_SPAN },
  {
    name: "trace",
    recordKind: "trace",
    source: getSampleTraceEvaluationContext().context as Record<
      string,
      unknown
    >,
  },
  {
    name: "two-turn session",
    recordKind: "session",
    source: TWO_TURN_SESSION,
  },
  {
    name: "four-turn session",
    recordKind: "session",
    source: FOUR_TURN_SESSION,
  },
];

/** Each level as typed: the path, then the `.` or `[` that opens it. */
const LEVELS = [
  "",
  "input.",
  "input.messages[",
  "input.tools[",
  "output.",
  "output.messages[-1].",
  "output.messages[-1].tool_calls[",
  "output.documents[",
  "metadata.",
  "metadata.turns[",
];

describe("getEvaluatorPathIdeas", () => {
  // The whole catalog, as each level offers it: a change to an idea or a rule
  // shows up here as a diff.
  it("offers each level's ideas", () => {
    const tree = RECORDS.flatMap(({ name, recordKind, source }) => [
      name,
      ...LEVELS.flatMap((level) => {
        const containerPath = level.slice(0, -1);
        const container = resolveEvaluatorPath({ source, path: containerPath });
        if (
          level !== "" &&
          (container.status !== "resolved" ||
            !isEvaluatorPathContainer(container.value))
        ) {
          return [];
        }
        const ideas = getEvaluatorPathIdeas({
          recordKind,
          source,
          containerPath,
          syntax: MAPPING_PATH_SYNTAX,
        });
        return [
          `  ${level || "(root)"} →`,
          ...ideas.map(
            ({ relativePath, description }) =>
              `    ${relativePath} | ${description}`
          ),
        ];
      }),
    ]).join("\n");

    expect(tree).toMatchInlineSnapshot(`
      "LLM span with tools
        (root) →
          input.messages[-1].content | Last message
          input.messages | Input messages
          input.tools | Available tools
          output.messages[-1].tool_calls | Tool calls
          output.messages[-1].content | Reply
        input. →
          messages[-1].content | Last message
          messages | Input messages
          tools | Available tools
          tools[*].function.name | Tool names
          messages[-1] | Last message
        input.messages[ →
          [-1].content | Last message
          [0] | First message
          [-1] | Last message
          [*] | All messages
          [:-1] | All but last
        input.tools[ →
          [*].function.name | Tool names
          [0] | First tool
          [-1] | Last tool
          [*] | All tools
          [*].type | Type of each
        output. →
          messages[-1].tool_calls | Tool calls
          messages[-1].content | Reply
          messages[-1].tool_calls[*].function.name | Tools called
          messages[-1].tool_calls[-1].function.arguments | Last call's arguments
          messages[-1] | Last message
        output.messages[-1]. →
          tool_calls | Tool calls
          content | Reply
          tool_calls[*].function.name | Tools called
          tool_calls[-1].function.arguments | Last call's arguments
          tool_calls[-1] | Last tool call
        output.messages[-1].tool_calls[ →
          [*].function.name | Tools called
          [-1].function.arguments | Last call's arguments
          [0] | First tool call
          [-1] | Last tool call
          [*] | All tool calls
        metadata. →
      retriever span
        (root) →
          output.documents[*].content | Document text
          output.documents[0].content | First document
        input. →
        output. →
          documents[*].content | Document text
          documents[0].content | First document
          documents[-1] | Last document
        output.documents[ →
          [*].content | Document text
          [0].content | First document
          [0] | First document
          [-1] | Last document
          [*] | All documents
        metadata. →
      trace
        (root) →
        metadata. →
      two-turn session
        (root) →
          metadata.turns[-1].input | Last user message
          metadata.turns[-1].output | Last response
          metadata.turns[:-1] | Earlier turns
          metadata.turns[*].input | All user messages
        metadata. →
          turns[-1].input | Last user message
          turns[-1].output | Last response
          turns[:-1] | Earlier turns
          turns[*].input | All user messages
          turns[-1] | Last turn
        metadata.turns[ →
          [-1].input | Last user message
          [-1].output | Last response
          [:-1] | Earlier turns
          [*].input | All user messages
          [0] | First turn
      four-turn session
        (root) →
          metadata.turns[-1].input | Last user message
          metadata.turns[-1].output | Last response
          metadata.turns[:-1] | Earlier turns
          metadata.turns[*].input | All user messages
        metadata. →
          turns[-1].input | Last user message
          turns[-1].output | Last response
          turns[:-1] | Earlier turns
          turns[*].input | All user messages
          turns[-1] | Last turn
        metadata.turns[ →
          [-1].input | Last user message
          [-1].output | Last response
          [:-1] | Earlier turns
          [*].input | All user messages
          [0] | First turn"
    `);
  });

  it("keeps every curated idea reachable on a record of its kind", () => {
    for (const { path, recordKinds } of CURATED_EVALUATOR_PATH_IDEAS) {
      for (const recordKind of recordKinds) {
        expect(
          RECORDS.some(
            (record) =>
              record.recordKind === recordKind &&
              resolveEvaluatorPath({ source: record.source, path }).status ===
                "resolved"
          )
        ).toBe(true);
      }
    }
  });

  it("offers only ideas the surface can write", () => {
    expect(
      getEvaluatorPathIdeas({
        recordKind: "session",
        source: FOUR_TURN_SESSION,
        containerPath: "metadata.turns",
        syntax: F_STRING_PATH_SYNTAX,
      }).map(({ path }) => path)
    ).toEqual([
      "metadata.turns[-1].input",
      "metadata.turns[-1].output",
      "metadata.turns[0]",
      "metadata.turns[-1]",
    ]);
  });
});
