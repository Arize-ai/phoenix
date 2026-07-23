import { describe, expect, it } from "vitest";

import { makeSessionUrls } from "../SessionPaginationContext";

describe("makeSessionUrls", () => {
  it("preserves recreatable URL state while clearing session-specific selections", () => {
    const location: Parameters<typeof makeSessionUrls>[0] = {
      pathname: "/projects/project-1/sessions/current-session",
      search:
        "?sessionView=traces&timeRangeKey=7d&timeRangeStart=2026-06-02T10%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A30.000Z&selectedTraceId=trace-1&selectedSpanNodeId=span-1",
      hash: "#details",
      state: null,
      key: "default",
    };

    const sessionSequence = [
      { sessionId: "current-session" },
      { sessionId: "next-session" },
    ];

    expect(
      makeSessionUrls(location, sessionSequence, "current-session")
        .nextSessionPath
    ).toBe(
      "/projects/project-1/sessions/next-session?sessionView=traces&timeRangeKey=7d&timeRangeStart=2026-06-02T10%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A30.000Z#details"
    );
  });

  it("returns plain session paths when there is no search state to preserve", () => {
    const location: Parameters<typeof makeSessionUrls>[0] = {
      pathname: "/projects/project-1/sessions/current-session",
      search: "",
      hash: "",
      state: null,
      key: "default",
    };

    const sessionSequence = [
      { sessionId: "previous-session" },
      { sessionId: "current-session" },
    ];

    expect(
      makeSessionUrls(location, sessionSequence, "current-session")
        .previousSessionPath
    ).toBe("/projects/project-1/sessions/previous-session");
  });
});
