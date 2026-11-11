import {
  acceptCompletion,
  autocompletion,
  type Completion,
  completionStatus,
  currentCompletions,
  startCompletion,
} from "@codemirror/autocomplete";
// one copy of @codemirror/state/view: the app has no direct dep on them
import {
  EditorSelection,
  EditorState,
  EditorView,
} from "@uiw/react-codemirror";
import { describe, expect, it } from "vitest";

import { createDSLFilterCompletionSource } from "../dslFilterConditionFieldUtils";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives a real EditorView through open-dropdown and accept at the `|` in
 * `conditionWithCursor`. Docs are written as the field leaves them, e.g. with
 * the `']` that closeBrackets (on in the field's basicSetup) inserts as the
 * user types `['`. Returns the offered labels and the doc after accepting the
 * first option.
 */
async function openAndAccept({
  conditionWithCursor,
  options,
}: {
  conditionWithCursor: string;
  options: Completion[];
}): Promise<{ offered: string[]; accepted: string }> {
  const cursor = conditionWithCursor.indexOf("|");
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: conditionWithCursor.replace("|", ""),
      selection: EditorSelection.cursor(cursor),
      extensions: [
        autocompletion({
          override: [createDSLFilterCompletionSource(() => options)],
          activateOnTyping: false,
        }),
      ],
    }),
  });
  try {
    startCompletion(view);
    for (
      let attempt = 0;
      attempt < 50 && completionStatus(view.state) !== "active";
      attempt++
    ) {
      await sleep(10);
    }
    const offered = currentCompletions(view.state).map(
      (completion) => completion.label
    );
    await sleep(100); // CodeMirror ignores accepts inside its interactionDelay
    acceptCompletion(view);
    return { offered, accepted: view.state.doc.toString() };
  } finally {
    view.destroy();
  }
}

const labels = (...names: string[]): Completion[] =>
  names.map((label) => ({ label }));

describe("DSL filter completion dropdown", () => {
  it.each([
    {
      name: "filters on the text before the cursor, ignoring the rest of the word",
      condition: "sta|foo",
      options: labels("status_code", "span_kind"),
      offered: ["status_code"],
    },
    {
      name: "keeps offering options when the key continues after the cursor",
      condition: "attributes['us|er_x']",
      options: labels(
        "attributes['usage']",
        "attributes['user']",
        "attributes['user.id']",
        "attributes['zzz']"
      ),
      offered: [
        "attributes['usage']",
        "attributes['user']",
        "attributes['user.id']",
      ],
    },
  ])("$name", async ({ condition, options, offered }) => {
    const result = await openAndAccept({
      conditionWithCursor: condition,
      options,
    });
    expect([...result.offered].sort()).toEqual([...offered].sort());
  });
});

describe("accepting a DSL filter completion", () => {
  it.each([
    {
      name: "mid-accessor replaces the rest of the member name",
      condition: "attributes['llm'].mo|del_name == 'x'",
      label: "attributes['llm'].model_name",
      expected: "attributes['llm'].model_name == 'x'",
    },
    {
      name: "inside a quoted subscript consumes the auto-closed quote and bracket",
      condition: "attributes['us|']",
      label: "attributes['user']",
      expected: "attributes['user']",
    },
    {
      name: "inside a nested quoted subscript consumes the auto-closed suffix",
      condition: "attributes['user']['id|']",
      label: "attributes['user']['id']",
      expected: "attributes['user']['id']",
    },
    {
      name: "at the end of a token leaves the rest of the condition alone",
      condition: "latency_ms > 1 and sta|",
      label: "status_code",
      expected: "latency_ms > 1 and status_code",
    },
    {
      name: "mid-token does not swallow an operator after the token",
      condition: "span_ki|nd=='LLM'",
      label: "span_kind",
      expected: "span_kind=='LLM'",
    },
    {
      name: "mid-token replaces the rest of the word",
      condition: "sta|foo",
      label: "status_code",
      expected: "status_code",
    },
    {
      name: "mid-key replaces the rest of the key through the closing quote and bracket",
      condition: "attributes['us|er_x']",
      label: "attributes['user']",
      expected: "attributes['user']",
    },
    {
      name: "mid-key replaces the rest of a dotted key",
      condition: "attributes['ll|m.model_name']",
      label: "attributes['llm.model_name']",
      expected: "attributes['llm.model_name']",
    },
    {
      name: "unclosed quote keeps the rest of the condition",
      condition: "attributes['us| == 1 and x]",
      label: "attributes['user']",
      expected: "attributes['user'] == 1 and x]",
    },
    {
      name: "unclosed quote followed by an and-clause keeps it",
      condition: "attributes['us| and x]",
      label: "attributes['user']",
      expected: "attributes['user'] and x]",
    },
    {
      name: "an unclosed key stops at the end of the key",
      condition: "attributes['us|er",
      label: "attributes['user']",
      expected: "attributes['user']",
    },
  ])("$name", async ({ condition, label, expected }) => {
    const { accepted } = await openAndAccept({
      conditionWithCursor: condition,
      options: labels(label),
    });
    expect(accepted).toBe(expected);
  });

  it("leaves an option that brings its own apply untouched", async () => {
    const { accepted } = await openAndAccept({
      conditionWithCursor: "sta|foo",
      options: [
        {
          label: "status_code == 'OK'",
          apply: (view, _completion, from) =>
            view.dispatch({
              changes: { from, to: view.state.doc.length, insert: "HISTORY" },
            }),
        },
      ],
    });
    expect(accepted).toBe("HISTORY");
  });
});
