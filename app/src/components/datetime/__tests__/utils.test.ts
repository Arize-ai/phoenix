import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLastNTimeRangeLabel,
  getMillisecondsUntilNextLastNTimeRangeRefresh,
  getTimeRangeFromSearchParams,
  getTimeRangeFromLastNTimeRangeKey,
  getTimeRangeSearchSuggestions,
  isLastNTimeRangeKey,
  panTimeRangeLeft,
  panTimeRangeRight,
  parseTimeRangeSearchText,
  setTimeRangeSearchParams,
  zoomTimeRangeIn,
  zoomTimeRangeOut,
} from "../utils";

describe("datetime utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes open-ended last-N ranges, snapping and refreshing by window length", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:20:30.000Z"));

    // Windows up to an hour (inclusive) snap and refresh to the minute
    const minutes = getTimeRangeFromLastNTimeRangeKey("25m");
    expect(minutes.start?.toISOString()).toBe("2026-06-09T09:55:00.000Z");
    expect(minutes.end).toBeNull();
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("25m")).toBe(30_000);
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("1h")).toBe(30_000);

    // Longer windows snap and refresh to the hour
    const hours = getTimeRangeFromLastNTimeRangeKey("2h");
    expect(hours.start?.toISOString()).toBe("2026-06-09T08:00:00.000Z");
    expect(hours.end).toBeNull();
    expect(getMillisecondsUntilNextLastNTimeRangeRefresh("2h")).toBe(2_370_000);
  });

  it("recognizes arbitrary last-N keys and rejects malformed ones", () => {
    expect(isLastNTimeRangeKey("25m")).toBe(true);
    expect(isLastNTimeRangeKey("3d")).toBe(true);
    expect(isLastNTimeRangeKey("0m")).toBe(false);
    expect(isLastNTimeRangeKey("25")).toBe(false);
    expect(isLastNTimeRangeKey("m")).toBe(false);
    expect(isLastNTimeRangeKey("custom")).toBe(false);
  });

  it("labels presets with their curated labels and other keys spelled out", () => {
    expect(getLastNTimeRangeLabel("15m")).toBe("Last 15 Min");
    expect(getLastNTimeRangeLabel("1h")).toBe("Last Hour");
    expect(getLastNTimeRangeLabel("25m")).toBe("Last 25 minutes");
    expect(getLastNTimeRangeLabel("2h")).toBe("Last 2 hours");
    expect(getLastNTimeRangeLabel("3d")).toBe("Last 3 days");
    expect(getLastNTimeRangeLabel("90m")).toBe("Last 90 minutes");
  });

  it("parses free-form search text into last-N keys", () => {
    expect(parseTimeRangeSearchText("25m")).toBe("25m");
    expect(parseTimeRangeSearchText(" 25 min ")).toBe("25m");
    expect(parseTimeRangeSearchText("Last 25 Minutes")).toBe("25m");
    expect(parseTimeRangeSearchText("2 hr")).toBe("2h");
    expect(parseTimeRangeSearchText("last 2 hours")).toBe("2h");
    expect(parseTimeRangeSearchText("3 days")).toBe("3d");
    expect(parseTimeRangeSearchText("")).toBeNull();
    expect(parseTimeRangeSearchText("25")).toBeNull();
    expect(parseTimeRangeSearchText("0m")).toBeNull();
    expect(parseTimeRangeSearchText("25x")).toBeNull();
    expect(parseTimeRangeSearchText("last")).toBeNull();
  });

  it("suggests every unit for a bare quantity and the exact key for a duration", () => {
    expect(getTimeRangeSearchSuggestions("25")).toEqual(["25m", "25h", "25d"]);
    expect(getTimeRangeSearchSuggestions("last 3")).toEqual(["3m", "3h", "3d"]);
    expect(getTimeRangeSearchSuggestions("25m")).toEqual(["25m"]);
    expect(getTimeRangeSearchSuggestions("2 hours")).toEqual(["2h"]);
    expect(getTimeRangeSearchSuggestions("")).toEqual([]);
    expect(getTimeRangeSearchSuggestions("0")).toEqual([]);
    expect(getTimeRangeSearchSuggestions("hour")).toEqual([]);
  });

  it("parses selected time ranges from URL search params", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:20:30.000Z"));

    // A preset key is always live, resolved against "now" with no bounds.
    const lastN = getTimeRangeFromSearchParams(
      new URLSearchParams("timeRangeKey=15m")
    );
    expect(lastN?.timeRangeKey).toBe("15m");
    expect(lastN?.start?.toISOString()).toBe("2026-06-09T10:05:00.000Z");
    expect(lastN?.end).toBeNull();

    // A preset key wins over any bounds in the URL, re-resolving live rather
    // than honoring the (now-stale) bounds. This also keeps legacy URLs that
    // carry both working as live presets.
    const presetWithStaleBounds = getTimeRangeFromSearchParams(
      new URLSearchParams(
        "timeRangeKey=15m&timeRangeStart=2026-06-09T09%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A00.000Z"
      )
    );
    expect(presetWithStaleBounds?.timeRangeKey).toBe("15m");
    expect(presetWithStaleBounds?.start?.toISOString()).toBe(
      "2026-06-09T10:05:00.000Z"
    );
    expect(presetWithStaleBounds?.end).toBeNull();

    const custom = getTimeRangeFromSearchParams(
      new URLSearchParams(
        "timeRangeStart=2026-06-09T09%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A00.000Z"
      )
    );
    expect(custom).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:00:00.000Z"),
      end: new Date("2026-06-09T10:00:00.000Z"),
    });

    expect(
      getTimeRangeFromSearchParams(new URLSearchParams("timeRange=bogus"))
    ).toBeNull();
    expect(
      getTimeRangeFromSearchParams(
        new URLSearchParams(
          "timeRangeKey=bogus&timeRangeStart=2026-06-09T09%3A00%3A00.000Z&timeRangeEnd=2026-06-09T10%3A00%3A00.000Z"
        )
      )
    ).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:00:00.000Z"),
      end: new Date("2026-06-09T10:00:00.000Z"),
    });
    expect(
      getTimeRangeFromSearchParams(
        new URLSearchParams("timeRangeStart=not-a-date")
      )
    ).toBeNull();
  });

  it("accepts deep-link start/end aliases when canonical bounds are absent", () => {
    // Server-generated deep links carry short `start`/`end` params.
    const aliased = getTimeRangeFromSearchParams(
      new URLSearchParams(
        "start=2026-06-09T09%3A00%3A00.000Z&end=2026-06-09T10%3A00%3A00.000Z"
      )
    );
    expect(aliased).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:00:00.000Z"),
      end: new Date("2026-06-09T10:00:00.000Z"),
    });

    // Canonical bounds win over aliases when both are present.
    const canonicalWins = getTimeRangeFromSearchParams(
      new URLSearchParams(
        "timeRangeStart=2026-06-09T08%3A00%3A00.000Z&timeRangeEnd=2026-06-09T09%3A00%3A00.000Z&start=2026-06-09T01%3A00%3A00.000Z&end=2026-06-09T02%3A00%3A00.000Z"
      )
    );
    expect(canonicalWins).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T08:00:00.000Z"),
      end: new Date("2026-06-09T09:00:00.000Z"),
    });

    // Invalid or inverted aliases are unusable, so callers fall back to the
    // stored preference rather than crashing.
    expect(
      getTimeRangeFromSearchParams(new URLSearchParams("start=not-a-date"))
    ).toBeNull();
    expect(
      getTimeRangeFromSearchParams(
        new URLSearchParams(
          "start=2026-06-09T10%3A00%3A00.000Z&end=2026-06-09T09%3A00%3A00.000Z"
        )
      )
    ).toBeNull();
  });

  it("serializes selected time ranges to URL search params", () => {
    const searchParams = new URLSearchParams(
      "timeRangeKey=7d&selectedSpanNodeId=span-1"
    );
    // A custom range is written as its bounds only, clearing any preset key.
    const customParams = setTimeRangeSearchParams({
      searchParams,
      timeRange: {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T09:00:00.000Z"),
        end: null,
      },
    });
    expect(customParams.get("timeRangeKey")).toBeNull();
    expect(customParams.get("timeRangeStart")).toBe("2026-06-09T09:00:00.000Z");
    expect(customParams.get("timeRangeEnd")).toBeNull();
    expect(customParams.get("selectedSpanNodeId")).toBe("span-1");

    // A preset is written as just the key, clearing any bounds, so the URL is
    // unambiguously a live range.
    const presetParams = setTimeRangeSearchParams({
      searchParams: customParams,
      timeRange: {
        timeRangeKey: "1h",
        ...getTimeRangeFromLastNTimeRangeKey(
          "1h",
          new Date("2026-06-09T10:20:30.000Z").getTime()
        ),
      },
    });
    expect(presetParams.get("timeRangeKey")).toBe("1h");
    expect(presetParams.get("timeRangeStart")).toBeNull();
    expect(presetParams.get("timeRangeEnd")).toBeNull();
    expect(presetParams.get("selectedSpanNodeId")).toBe("span-1");
  });

  it("clears deep-link start/end aliases when a new range is written", () => {
    const deepLinkParams = new URLSearchParams(
      "start=2026-06-09T09%3A00%3A00.000Z&end=2026-06-09T10%3A00%3A00.000Z&filter=span_kind+%3D%3D+%27LLM%27"
    );
    const nextParams = setTimeRangeSearchParams({
      searchParams: deepLinkParams,
      timeRange: {
        timeRangeKey: "1h",
        ...getTimeRangeFromLastNTimeRangeKey(
          "1h",
          new Date("2026-06-09T10:20:30.000Z").getTime()
        ),
      },
    });
    // The superseded aliases are dropped; unrelated params are preserved.
    expect(nextParams.get("start")).toBeNull();
    expect(nextParams.get("end")).toBeNull();
    expect(nextParams.get("timeRangeKey")).toBe("1h");
    expect(nextParams.get("filter")).toBe("span_kind == 'LLM'");
  });
});

describe("time range pan and zoom", () => {
  const now = new Date("2026-06-09T12:00:00.000Z");

  it("pans a closed range back by half its window", () => {
    const next = panTimeRangeLeft({
      value: {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T10:00:00.000Z"),
        end: new Date("2026-06-09T11:00:00.000Z"),
      },
      now,
    });
    expect(next).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:30:00.000Z"),
      end: new Date("2026-06-09T10:30:00.000Z"),
    });
  });

  it("pans a live range back into a closed custom range", () => {
    const next = panTimeRangeLeft({
      value: {
        timeRangeKey: "1h",
        start: new Date("2026-06-09T11:00:00.000Z"),
        end: null,
      },
      now,
    });
    expect(next).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T10:30:00.000Z"),
      end: new Date("2026-06-09T11:30:00.000Z"),
    });
  });

  it("pans a closed range forward, clamped to now", () => {
    const halfStep = panTimeRangeRight({
      value: {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T09:00:00.000Z"),
        end: new Date("2026-06-09T10:00:00.000Z"),
      },
      now,
    });
    expect(halfStep).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T09:30:00.000Z"),
      end: new Date("2026-06-09T10:30:00.000Z"),
    });

    const clamped = panTimeRangeRight({
      value: {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T10:45:00.000Z"),
        end: new Date("2026-06-09T11:45:00.000Z"),
      },
      now,
    });
    expect(clamped).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T11:00:00.000Z"),
      end: new Date("2026-06-09T12:00:00.000Z"),
    });
  });

  it("does not pan forward past now or pan a live range forward", () => {
    expect(
      panTimeRangeRight({
        value: {
          timeRangeKey: "custom",
          start: new Date("2026-06-09T11:00:00.000Z"),
          end: now,
        },
        now,
      })
    ).toBeNull();
    expect(
      panTimeRangeRight({
        value: {
          timeRangeKey: "1h",
          start: new Date("2026-06-09T11:00:00.000Z"),
        },
        now,
      })
    ).toBeNull();
  });

  it("zooms a closed range around its center", () => {
    const value = {
      timeRangeKey: "custom" as const,
      start: new Date("2026-06-09T08:00:00.000Z"),
      end: new Date("2026-06-09T10:00:00.000Z"),
    };
    expect(zoomTimeRangeIn({ value, now })).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T08:30:00.000Z"),
      end: new Date("2026-06-09T09:30:00.000Z"),
    });
    expect(zoomTimeRangeOut({ value, now })).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T07:00:00.000Z"),
      end: new Date("2026-06-09T11:00:00.000Z"),
    });
  });

  it("slides a zoom-out back when it would extend past now", () => {
    const next = zoomTimeRangeOut({
      value: {
        timeRangeKey: "custom",
        start: new Date("2026-06-09T10:00:00.000Z"),
        end: new Date("2026-06-09T12:00:00.000Z"),
      },
      now,
    });
    // Doubling around the center would end at 13:00; the overflow is pushed
    // back so the window still doubles but ends at now.
    expect(next).toEqual({
      timeRangeKey: "custom",
      start: new Date("2026-06-09T08:00:00.000Z"),
      end: new Date("2026-06-09T12:00:00.000Z"),
    });
  });

  it("keeps live ranges live, mapping zoom to the equivalent last-N key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const lastHour = {
      timeRangeKey: "1h" as const,
      start: new Date("2026-06-09T11:00:00.000Z"),
      end: null,
    };
    expect(zoomTimeRangeIn({ value: lastHour, now })).toEqual({
      timeRangeKey: "30m",
      ...getTimeRangeFromLastNTimeRangeKey("30m"),
    });
    expect(zoomTimeRangeOut({ value: lastHour, now })).toEqual({
      timeRangeKey: "2h",
      ...getTimeRangeFromLastNTimeRangeKey("2h"),
    });
    // Half of 7 days is 3.5 days — at two-plus days the key snaps to the
    // nearest whole day instead of dropping to "84h".
    expect(
      zoomTimeRangeIn({
        value: {
          timeRangeKey: "7d",
          start: new Date("2026-06-02T12:00:00.000Z"),
        },
        now,
      })?.timeRangeKey
    ).toBe("4d");
    // A fraction below two of the next unit keeps the smaller unit.
    expect(
      zoomTimeRangeIn({
        value: {
          timeRangeKey: "3h",
          start: new Date("2026-06-09T09:00:00.000Z"),
        },
        now,
      })?.timeRangeKey
    ).toBe("90m");
  });

  it("rounds large zoomed live windows to days instead of accumulating hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Doubling out of "2048h" reads as days, not "4096h".
    expect(
      zoomTimeRangeOut({
        value: {
          timeRangeKey: "2048h",
          start: new Date(now.getTime() - 2048 * 60 * 60 * 1000),
          end: null,
        },
        now,
      })?.timeRangeKey
    ).toBe("171d");
    // And once in days, zooming stays in days.
    expect(
      zoomTimeRangeOut({
        value: {
          timeRangeKey: "171d",
          start: new Date(now.getTime() - 171 * 24 * 60 * 60 * 1000),
          end: null,
        },
        now,
      })?.timeRangeKey
    ).toBe("342d");
  });

  it("zooms a closed range by the exact factor, preserving its span", () => {
    // A 50-minute custom window doubles to exactly 100 minutes around its
    // center; custom windows show concrete datetimes, so the span is exact.
    const fiftyMinutes = {
      timeRangeKey: "custom" as const,
      start: new Date("2026-06-09T10:00:00.000Z"),
      end: new Date("2026-06-09T10:50:00.000Z"),
    };
    expect(zoomTimeRangeOut({ value: fiftyMinutes, now })).toEqual({
      timeRangeKey: "custom",
      // Center 10:25 ± 50m → 09:35–11:15, fully before now (12:00).
      start: new Date("2026-06-09T09:35:00.000Z"),
      end: new Date("2026-06-09T11:15:00.000Z"),
    });
  });

  it("stops zooming in at the one minute floor", () => {
    expect(
      zoomTimeRangeIn({
        value: {
          timeRangeKey: "1m",
          start: new Date("2026-06-09T11:59:00.000Z"),
        },
        now,
      })
    ).toBeNull();
    expect(
      zoomTimeRangeIn({
        value: {
          timeRangeKey: "custom",
          start: new Date("2026-06-09T11:59:00.000Z"),
          end: now,
        },
        now,
      })
    ).toBeNull();
  });

  it("returns null when the range has no resolvable window", () => {
    const startless = { timeRangeKey: "custom" as const, end: now };
    expect(panTimeRangeLeft({ value: startless, now })).toBeNull();
    expect(panTimeRangeRight({ value: startless, now })).toBeNull();
    expect(zoomTimeRangeIn({ value: startless, now })).toBeNull();
    expect(zoomTimeRangeOut({ value: startless, now })).toBeNull();
  });
});
