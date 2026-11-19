import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  parseThreadMessage,
  slackEnvelopeSchema,
  verifySlackSignature,
} from "../src/slack/events";

describe("Slack event verification", () => {
  const timestamp = "1795090000";
  const signingSecret = "test-signing-secret";
  const body = JSON.stringify({
    type: "url_verification",
    challenge: "challenge",
  });
  const signature = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${body}`).digest("hex")}`;

  it("accepts an authentic request and rejects a modified body", () => {
    expect(
      verifySlackSignature({
        body,
        timestamp,
        signingSecret,
        signature,
        now: Number(timestamp) * 1000,
      })
    ).toBe(true);
    expect(
      verifySlackSignature({
        body: `${body} `,
        timestamp,
        signingSecret,
        signature,
        now: Number(timestamp) * 1000,
      })
    ).toBe(false);
  });

  it("rejects replayed requests, missing signatures and invalid timestamps", () => {
    expect(
      verifySlackSignature({
        body,
        timestamp,
        signingSecret,
        signature,
        now: (Number(timestamp) + 301) * 1000,
      })
    ).toBe(false);
    expect(
      verifySlackSignature({ body, timestamp, signingSecret, signature: null })
    ).toBe(false);
    expect(
      verifySlackSignature({
        body,
        timestamp: "not-a-timestamp",
        signingSecret,
        signature,
      })
    ).toBe(false);
  });
});

describe("Slack thread routing", () => {
  function createEnvelope(
    event: Record<string, unknown>
  ): ReturnType<typeof slackEnvelopeSchema.parse> {
    return slackEnvelopeSchema.parse({
      type: "event_callback",
      team_id: "workspace",
      event_id: "event",
      event,
    });
  }

  it("routes a parent mention and another person's ordinary reply to the same thread", () => {
    const parent = parseThreadMessage({
      botUserId: "factory",
      envelope: createEnvelope({
        type: "app_mention",
        channel: "channel",
        user: "alex",
        text: "<@factory> help",
        ts: "100.000100",
      }),
    });
    const reply = parseThreadMessage({
      botUserId: "factory",
      envelope: createEnvelope({
        type: "message",
        channel: "channel",
        user: "sam",
        text: "Also check exports",
        ts: "101.000200",
        thread_ts: "100.000100",
      }),
    });
    expect(parent?.threadTimestamp).toBe("100.000100");
    expect(reply).toMatchObject({
      threadTimestamp: parent?.threadTimestamp,
      userId: "sam",
      isMention: false,
    });
  });

  it("recognizes mentions received through message subscriptions", () => {
    const message = parseThreadMessage({
      botUserId: "factory",
      envelope: createEnvelope({
        type: "message",
        channel: "channel",
        user: "alex",
        text: "<@factory> help",
        ts: "100.000100",
      }),
    });
    expect(message?.isMention).toBe(true);
  });

  it("ignores bot messages, edits and events without message fields", () => {
    for (const event of [
      { type: "message", user: "factory", text: "reply", ts: "100" },
      {
        type: "message",
        user: "alex",
        bot_id: "another-bot",
        text: "reply",
        ts: "100",
      },
      {
        type: "message",
        subtype: "message_changed",
        text: "edited",
        ts: "100",
      },
      { type: "reaction_added" },
    ]) {
      expect(
        parseThreadMessage({
          botUserId: "factory",
          envelope: createEnvelope({ channel: "channel", ...event }),
        })
      ).toBeUndefined();
    }
  });
});
