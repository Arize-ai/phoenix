import { formatPromptVersionMetadataForEditor } from "../playgroundPromptUtils";

describe("formatPromptVersionMetadataForEditor", () => {
  it("pretty-prints metadata from the latest prompt version", () => {
    expect(
      formatPromptVersionMetadataForEditor({
        owner: "evaluation",
        revision: 2,
      })
    ).toBe(`{
  "owner": "evaluation",
  "revision": 2
}`);
  });

  it("uses an empty object when metadata is missing", () => {
    expect(formatPromptVersionMetadataForEditor(undefined)).toBe("{}");
    expect(formatPromptVersionMetadataForEditor(null)).toBe("{}");
  });
});
