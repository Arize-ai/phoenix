import { describe, expect, it } from "vitest";

import { extractFilterExpression } from "../ai/extractFilterExpression";

describe("extractFilterExpression", () => {
  it("passes a bare expression through untouched", () => {
    expect(extractFilterExpression("status_code == 'ERROR'")).toBe(
      "status_code == 'ERROR'"
    );
  });

  it("unwraps a fenced code block with a language tag", () => {
    expect(extractFilterExpression("```python\nspan_kind == 'LLM'\n```")).toBe(
      "span_kind == 'LLM'"
    );
  });

  it("unwraps a fence without a language tag", () => {
    expect(extractFilterExpression("```\nlatency_ms > 1000\n```")).toBe(
      "latency_ms > 1000"
    );
  });

  it("unwraps a streamed partial whose closing fence has not arrived", () => {
    expect(extractFilterExpression("```python\nspan_kind == 'LLM'")).toBe(
      "span_kind == 'LLM'"
    );
    expect(extractFilterExpression("```\nlatency_ms >")).toBe("latency_ms >");
  });

  it("drops a leading label", () => {
    expect(
      extractFilterExpression(
        "Expression: latency_ms > 1000 and span_kind == 'LLM'"
      )
    ).toBe("latency_ms > 1000 and span_kind == 'LLM'");
    expect(extractFilterExpression("filter: name == 'OpenAI'")).toBe(
      "name == 'OpenAI'"
    );
  });

  it("unwraps single backticks around the whole expression", () => {
    expect(extractFilterExpression("`status_code == 'OK'`")).toBe(
      "status_code == 'OK'"
    );
  });

  it("collapses a wrapped answer onto a single line", () => {
    expect(
      extractFilterExpression("status_code == 'ERROR'\n  and latency_ms > 500")
    ).toBe("status_code == 'ERROR' and latency_ms > 500");
  });

  it("does not strip quotes that belong to the expression", () => {
    expect(extractFilterExpression("'error' in output.value")).toBe(
      "'error' in output.value"
    );
  });

  it("returns an empty string for empty or whitespace output", () => {
    expect(extractFilterExpression("   \n ")).toBe("");
  });

  it("extracts the tagged answer and discards the thinking", () => {
    expect(
      extractFilterExpression(
        "<thinking>The request points at the output field.</thinking>\n<expression>'sorry' in output.value or 'apolog' in output.value</expression>"
      )
    ).toBe("'sorry' in output.value or 'apolog' in output.value");
  });

  it("suppresses streamed partials while the thinking is still forming", () => {
    expect(extractFilterExpression("<thin")).toBe("");
    expect(
      extractFilterExpression("<thinking>The request describes an apo")
    ).toBe("");
    expect(
      extractFilterExpression("<thinking>Search the output.</thinking>\n<expr")
    ).toBe("");
  });

  it("streams a tagged answer whose closing tag has not arrived", () => {
    expect(
      extractFilterExpression(
        "<thinking>Search the output.</thinking><expression>'sorry' in outp"
      )
    ).toBe("'sorry' in outp");
  });

  it("strips a partially streamed closing tag", () => {
    expect(
      extractFilterExpression("<expression>'sorry' in output.value</expres")
    ).toBe("'sorry' in output.value");
  });

  it("does not mistake comparison operators for tags", () => {
    expect(
      extractFilterExpression(
        "<expression>latency_ms < 1000 and llm.token_count.completion < llm.token_count.total / 2</expression>"
      )
    ).toBe(
      "latency_ms < 1000 and llm.token_count.completion < llm.token_count.total / 2"
    );
  });

  it("still accepts a bare answer after a thinking block", () => {
    expect(
      extractFilterExpression(
        "<thinking>Search the output for the phrase.</thinking>\n'timeout' in status_message"
      )
    ).toBe("'timeout' in status_message");
  });
});
