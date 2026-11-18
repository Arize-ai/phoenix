import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsEvent } from "../sanitizeAnalyticsEvent";

const event = {
  uuid: "event-uuid",
  event: "$pageview",
  timestamp: new Date("2026-01-01T00:00:00Z"),
  $set_once: { $initial_current_url: "https://phoenix.acme.internal/projects" },
  properties: {
    token: "phc_test",
    distinct_id: "anonymous-id",
    $process_person_profile: false,
    $browser: "Chrome",
    $current_url: "https://phoenix.acme.internal/projects/UHJvamVjdDox",
    $host: "phoenix.acme.internal",
    $pathname: "/projects/UHJvamVjdDox",
    $raw_user_agent: "Mozilla/5.0",
    $timezone: "America/Denver",
    $session_entry_url: "https://phoenix.acme.internal/",
    title: "Acme support bot",
    route: "/projects/:projectId",
    phoenix_version: "21.2.0",
  },
};

describe("sanitizeAnalyticsEvent", () => {
  it("keeps only allowlisted SDK properties and Phoenix properties", () => {
    expect(sanitizeAnalyticsEvent({ event })).toEqual({
      uuid: "event-uuid",
      event: "$pageview",
      timestamp: new Date("2026-01-01T00:00:00Z"),
      properties: {
        token: "phc_test",
        distinct_id: "anonymous-id",
        $process_person_profile: false,
        $browser: "Chrome",
        route: "/projects/:projectId",
        phoenix_version: "21.2.0",
        $current_url: "/projects/:projectId",
        $pathname: "/projects/:projectId",
      },
    });
  });

  it("drops events Phoenix did not capture", () => {
    const { route: _route, ...propertiesWithoutRoute } = event.properties;
    expect(
      sanitizeAnalyticsEvent({
        event: {
          ...event,
          event: "$exception",
          properties: propertiesWithoutRoute,
        },
      })
    ).toBeNull();
  });
});
