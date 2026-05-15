import {
  getServerExecutedToolNames,
  parseAgentAdvertisedToolsData,
} from "@phoenix/agent/chat/advertisedTools";

describe("advertisedTools", () => {
  it("parses advertised tool ownership data", () => {
    const data = parseAgentAdvertisedToolsData({
      tools: [
        { name: "bash", execution: "browser", family: "external" },
        {
          name: "query_docs_filesystem_phoenix",
          execution: "server",
          family: "docs",
        },
      ],
    });

    expect(data).toEqual({
      tools: [
        { name: "bash", execution: "browser", family: "external" },
        {
          name: "query_docs_filesystem_phoenix",
          execution: "server",
          family: "docs",
        },
      ],
    });
    expect(getServerExecutedToolNames(data!)).toEqual(
      new Set(["query_docs_filesystem_phoenix"])
    );
  });

  it("rejects malformed advertised tool data", () => {
    expect(
      parseAgentAdvertisedToolsData({
        tools: [{ name: "search_phoenix", execution: "elsewhere" }],
      })
    ).toBeNull();
  });
});
