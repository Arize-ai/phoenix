import { randomUUID } from "crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

/**
 * URL deep-linking for the project spans table.
 *
 * A link of the form
 * `/projects/{projectId}/spans?filter=<condition>&start=<ISO>&end=<ISO>`
 * must open the spans table with the filter condition seeded into the filter
 * field, the rows narrowed to spans matching the condition, and the time
 * range set to the given custom window.
 */

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// The tenant value deliberately carries a quote so the round-trip through URL
// encoding into the filter field is exercised. The condition uses the grammar
// the filter field accepts (a Python expression), where a value containing a
// single quote is written as a double-quoted string.
const TENANT = "o'brien-corp";
const FILTER_CONDITION = `metadata['tenant'] == "o'brien-corp"`;

function randomHex(length: number): string {
  let hex = "";
  while (hex.length < length) {
    hex += randomUUID().replaceAll("-", "");
  }
  return hex.slice(0, length);
}

function makeSpan({
  name,
  tenant,
  time,
}: {
  name: string;
  tenant: string;
  time: Date;
}) {
  return {
    name,
    context: {
      trace_id: randomHex(32),
      span_id: randomHex(16),
    },
    span_kind: "LLM",
    start_time: time.toISOString(),
    end_time: new Date(time.getTime() + 1000).toISOString(),
    status_code: "OK",
    status_message: "",
    attributes: {
      metadata: { tenant },
    },
    events: [],
  };
}

/**
 * Seeds a fresh project with three spans against a [2h ago, 1h ago] window:
 * one matching both the tenant filter and the window, one inside the window
 * with a different tenant (excluded by the filter), and one matching the
 * filter but outside the window (excluded by the time range).
 */
async function seedProject(request: APIRequestContext) {
  const runId = randomUUID().slice(0, 8);
  const projectName = `deep-link-${runId}`;
  const spanNamePrefix = `deeplink-${runId}`;

  const now = Date.now();
  const windowStart = new Date(now - 2 * HOUR_MS);
  const windowEnd = new Date(now - HOUR_MS);
  const insideWindow = new Date(now - 90 * MINUTE_MS);
  const outsideWindow = new Date(now - 10 * MINUTE_MS);

  const spans = [
    makeSpan({
      name: `${spanNamePrefix}-match`,
      tenant: TENANT,
      time: insideWindow,
    }),
    makeSpan({
      name: `${spanNamePrefix}-other-tenant`,
      tenant: "acme",
      time: insideWindow,
    }),
    makeSpan({
      name: `${spanNamePrefix}-outside-window`,
      tenant: TENANT,
      time: outsideWindow,
    }),
  ];

  const createResponse = await request.post(
    `/v1/projects/${encodeURIComponent(projectName)}/spans`,
    { data: { data: spans } }
  );
  expect(createResponse.ok()).toBe(true);

  // Span insertion is queued; poll until every span is visible via the API.
  await expect
    .poll(async () => {
      const listResponse = await request.get(
        `/v1/projects/${encodeURIComponent(projectName)}/spans`
      );
      if (!listResponse.ok()) {
        return 0;
      }
      const body = (await listResponse.json()) as { data?: unknown[] };
      return body.data?.length ?? 0;
    })
    .toBe(spans.length);

  const projectResponse = await request.get(
    `/v1/projects/${encodeURIComponent(projectName)}`
  );
  expect(projectResponse.ok()).toBe(true);
  const projectBody = (await projectResponse.json()) as {
    data: { id: string };
  };

  return {
    projectId: projectBody.data.id,
    spanNamePrefix,
    windowStart,
    windowEnd,
  };
}

function seededSpanLinks(page: Page, spanNamePrefix: string) {
  return page.getByRole("link", { name: new RegExp(spanNamePrefix) });
}

test.describe("Span deep links", () => {
  test("opens the spans table with the filter and time range applied", async ({
    page,
    request,
  }) => {
    const { projectId, spanNamePrefix, windowStart, windowEnd } =
      await seedProject(request);
    const search = new URLSearchParams({
      filter: FILTER_CONDITION,
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    });
    await page.goto(`/projects/${projectId}/spans?${search.toString()}`);

    // The condition lands in the filter field verbatim, quotes intact.
    const filterField = page.getByRole("textbox", { name: "Filter spans" });
    await expect(filterField).toContainText(FILTER_CONDITION);
    // The condition passes validation — an invalid one would flag the field
    // with an error affordance (and would never filter the rows below).
    await expect(page.getByLabel("Filter condition error")).not.toBeVisible();

    // The time range reflects the params: the selector shows a custom range
    // rather than a last-N preset.
    await expect(
      page.getByRole("group", { name: "Time range" }).getByText("Custom")
    ).toBeVisible();

    // Only the span matching both the filter and the window remains.
    await expect(
      page.getByRole("link", { name: `${spanNamePrefix}-match` })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: `${spanNamePrefix}-other-tenant` })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: `${spanNamePrefix}-outside-window` })
    ).not.toBeVisible();
    await expect(seededSpanLinks(page, spanNamePrefix)).toHaveCount(1);
  });

  test("shows all spans and an empty filter without deep-link params", async ({
    page,
    request,
  }) => {
    const { projectId, spanNamePrefix } = await seedProject(request);
    await page.goto(`/projects/${projectId}/spans`);

    // Default view: no filter, default (last-N) time range, all rows shown —
    // a different row count than the filtered deep-link view.
    await expect(seededSpanLinks(page, spanNamePrefix)).toHaveCount(3);
    // The filter field is empty (it shows only its placeholder, which the
    // CodeMirror editor renders inside the content element).
    await expect(
      page.getByRole("textbox", { name: "Filter spans" })
    ).not.toContainText("metadata");
    await expect(
      page.getByRole("group", { name: "Time range" }).getByText("Custom")
    ).not.toBeVisible();
  });
});
