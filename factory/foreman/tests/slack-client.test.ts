import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postThreadReply, readSlackThread } from "../src/slack/client";

const fetchSlack = vi.fn<typeof fetch>();
const thread = {
  channelId: "channel",
  threadTimestamp: "100.000100",
  latestTimestamp: "102.000200",
};

beforeEach(() => {
  fetchSlack.mockReset();
  vi.stubGlobal("fetch", fetchSlack);
  vi.stubEnv("SLACK_BOT_TOKEN", "test-bot-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function readRequest(callIndex: number): {
  url: string;
  headers: Headers;
  body: URLSearchParams;
} {
  const [input, options] = fetchSlack.mock.calls[callIndex];
  return {
    url: String(input),
    headers: new Headers(options?.headers),
    body: new URLSearchParams(String(options?.body)),
  };
}

describe("Slack thread history", () => {
  it("paginates with the same inclusive upper bound and preserves attribution", async () => {
    fetchSlack
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [{ user: "alex", text: "First", ts: "100.000100" }],
          response_metadata: { next_cursor: "next-page" },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [
            { user: "sam", text: "Follow-up", ts: "101.000200" },
            { ts: "102.000200" },
          ],
          response_metadata: { next_cursor: "" },
        })
      );
    expect(await readSlackThread(thread)).toEqual([
      { user_id: "alex", text: "First", message_timestamp: "100.000100" },
      { user_id: "sam", text: "Follow-up", message_timestamp: "101.000200" },
      { user_id: undefined, text: "", message_timestamp: "102.000200" },
    ]);
    expect(fetchSlack).toHaveBeenCalledTimes(2);
    for (const callIndex of [0, 1]) {
      const request = readRequest(callIndex);
      expect(request.url).toBe("https://slack.com/api/conversations.replies");
      expect(request.headers.get("authorization")).toBe(
        "Bearer test-bot-token"
      );
      expect(Object.fromEntries(request.body)).toMatchObject({
        channel: "channel",
        ts: "100.000100",
        latest: "102.000200",
        inclusive: "true",
        limit: "100",
      });
    }
    expect(readRequest(0).body.has("cursor")).toBe(false);
    expect(readRequest(1).body.get("cursor")).toBe("next-page");
  });

  it("accepts an empty thread and stops when there is no cursor", async () => {
    fetchSlack.mockResolvedValueOnce(Response.json({ ok: true, messages: [] }));
    expect(await readSlackThread(thread)).toEqual([]);
    expect(fetchSlack).toHaveBeenCalledTimes(1);
  });

  it.each([{}, { messages: [{}] }])(
    "rejects incomplete history (%j)",
    async (response) => {
      fetchSlack.mockResolvedValueOnce(
        Response.json({ ok: true, ...response })
      );
      await expect(readSlackThread(thread)).rejects.toThrow(
        "Slack rejected thread lookup."
      );
    }
  );

  it("fails rather than returning partial history when a later page fails", async () => {
    fetchSlack
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          messages: [{ ts: "100.000100" }],
          response_metadata: { next_cursor: "next-page" },
        })
      )
      .mockResolvedValueOnce(
        Response.json({ ok: false, error: "not_in_channel" })
      );
    await expect(readSlackThread(thread)).rejects.toThrow(
      "Slack thread lookup failed."
    );
    expect(fetchSlack).toHaveBeenCalledTimes(2);
  });
});

describe("Slack replies", () => {
  it("posts the supplied text into the parent thread", async () => {
    fetchSlack.mockResolvedValueOnce(Response.json({ ok: true }));
    await postThreadReply({
      channelId: "channel",
      threadTimestamp: "100.000100",
      text: "Hello & welcome",
    });
    const request = readRequest(0);
    expect(request.url).toBe("https://slack.com/api/chat.postMessage");
    expect(request.headers.get("authorization")).toBe("Bearer test-bot-token");
    expect(Object.fromEntries(request.body)).toMatchObject({
      channel: "channel",
      thread_ts: "100.000100",
      text: "Hello & welcome",
    });
  });

  it.each([
    () => Response.json({ ok: false, error: "invalid_auth" }),
    () => new Response("upstream details", { status: 500 }),
    () => new Response(null, { status: 429, headers: { "retry-after": "60" } }),
  ])(
    "rejects failures without retrying or exposing response details",
    async (createResponse) => {
      fetchSlack.mockResolvedValueOnce(createResponse());
      await expect(
        postThreadReply({
          channelId: "channel",
          threadTimestamp: "100.000100",
          text: "Hello",
        })
      ).rejects.toThrow("Slack message delivery failed.");
      expect(fetchSlack).toHaveBeenCalledTimes(1);
    }
  );

  it("requires a token before making a request", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    await expect(readSlackThread(thread)).rejects.toThrow(
      "SLACK_BOT_TOKEN is required."
    );
    await expect(
      postThreadReply({
        channelId: "channel",
        threadTimestamp: "100",
        text: "Hi",
      })
    ).rejects.toThrow("SLACK_BOT_TOKEN is required.");
    expect(fetchSlack).not.toHaveBeenCalled();
  });
});
