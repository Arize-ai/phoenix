import {
  getBashToolInput,
  getBashToolSummary,
} from "@phoenix/agent/tools/bash/bashToolSchema";

describe("getBashToolSummary", () => {
  it("returns the summary from a complete input", () => {
    expect(
      getBashToolSummary({ command: "ls -la", summary: "Listing files" })
    ).toBe("Listing files");
  });

  it("returns the summary while still streaming, before command arrives", () => {
    // The model emits `summary` before `command`, so during streaming the
    // partial input has a summary but no command yet.
    expect(getBashToolSummary({ summary: "Listing files" })).toBe(
      "Listing files"
    );
  });
});

describe("getBashToolInput", () => {
  it("requires command to be a string", () => {
    expect(getBashToolInput({ summary: "Listing files" })).toBeNull();
    expect(
      getBashToolInput({ command: "ls", summary: "Listing files" })
    ).toEqual({
      command: "ls",
      summary: "Listing files",
    });
  });

  it("passes through mutation_intent when it is a string", () => {
    expect(
      getBashToolInput({
        command: "phoenix-gql 'mutation { deleteDataset }'",
        mutation_intent: "Deletes the dataset.",
      })
    ).toEqual({
      command: "phoenix-gql 'mutation { deleteDataset }'",
      mutation_intent: "Deletes the dataset.",
    });
    expect(getBashToolInput({ command: "ls", mutation_intent: 42 })).toEqual({
      command: "ls",
    });
  });
});
