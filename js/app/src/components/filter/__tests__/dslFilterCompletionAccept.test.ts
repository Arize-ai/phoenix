import {
  CompletionContext,
  type CompletionResult,
  insertCompletionText,
} from "@codemirror/autocomplete";
import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { createDSLFilterCompletionSource } from "../dslFilterConditionFieldUtils";

/**
 * Accepts `label` at the `|` in `conditionWithCursor` the way CodeMirror does:
 * `applyCompletion` replaces `result.from` to `result.to ?? cursor`. Docs are
 * written as the field leaves them, e.g. with the `']` that closeBrackets
 * (on in the field's basicSetup) inserts as the user types `['`.
 */
async function acceptCompletionAtCursor(
  conditionWithCursor: string,
  label: string
): Promise<string> {
  const cursor = conditionWithCursor.indexOf("|");
  const doc = conditionWithCursor.replace("|", "");
  const source = createDSLFilterCompletionSource(() => [{ label }]);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
  });
  const result = (await source(
    new CompletionContext(state, cursor, true)
  )) as CompletionResult;
  expect(result).not.toBeNull();
  return state
    .update(
      insertCompletionText(state, label, result.from, result.to ?? cursor)
    )
    .state.doc.toString();
}

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
  ])("$name", async ({ condition, label, expected }) => {
    expect(await acceptCompletionAtCursor(condition, label)).toBe(expected);
  });
});
