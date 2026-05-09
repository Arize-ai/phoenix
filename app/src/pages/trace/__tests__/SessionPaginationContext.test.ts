import { describe, expect, it } from "vitest";

import { makeSessionUrls } from "../SessionPaginationContext";

describe("makeSessionUrls", () => {
  it("preserves recreatable URL state while clearing session-specific selections", () => {
    const location = {
      pathname: "/projects/project-1/sessions/current-session",
      search:
        "?sessionView=traces&timeRange=7d&selectedTraceId=trace-1&selectedSpanNodeId=span-1",
      hash: "#details",
    } as Parameters<typeof makeSessionUrls>[0];

    const sessionSequence = [
      { sessionId: "current-session" },
      { sessionId: "next-session" },
    ];

    expect(
      makeSessionUrls(location, sessionSequence, "current-session")
        .nextSessionPath
    ).toBe(
      "/projects/project-1/sessions/next-session?sessionView=traces&timeRange=7d#details"
    );
  });

  it("returns plain session paths when there is no search state to preserve", () => {
    const location = {
      pathname: "/projects/project-1/sessions/current-session",
      search: "",
      hash: "",
    } as Parameters<typeof makeSessionUrls>[0];

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
