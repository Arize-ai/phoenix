import { randomUUID } from "crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const NUM_RECORDS_PER_PAGE = 10;

function makeSpanNames({
  prefix,
  count,
}: {
  prefix: string;
  count: number;
}): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index).padStart(2, "0")}`
  );
}

async function createProject({
  page,
  projectName,
}: {
  page: Page;
  projectName: string;
}): Promise<string> {
  const response = await page.request.post("/v1/projects", {
    data: { name: projectName },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data.id;
}

/**
 * Sends one root span per name, each starting a second after the one before,
 * so a later name is a newer span.
 */
async function sendRootSpans({
  page,
  projectName,
  spanNames,
  firstStartTimeMs,
}: {
  page: Page;
  projectName: string;
  spanNames: string[];
  firstStartTimeMs: number;
}) {
  const response = await page.request.post(
    `/v1/projects/${encodeURIComponent(projectName)}/spans`,
    {
      data: {
        data: spanNames.map((name, index) => {
          const startTimeMs = firstStartTimeMs + index * 1000;
          return {
            name,
            context: {
              trace_id: randomUUID().replace(/-/g, ""),
              span_id: randomUUID().replace(/-/g, "").slice(0, 16),
            },
            span_kind: "CHAIN",
            parent_id: null,
            start_time: new Date(startTimeMs).toISOString(),
            end_time: new Date(startTimeMs + 50).toISOString(),
            status_code: "OK",
            attributes: { "input.value": "hello" },
          };
        }),
      },
    }
  );
  expect(response.ok()).toBeTruthy();
}

async function countProjectSpans({
  page,
  projectName,
}: {
  page: Page;
  projectName: string;
}): Promise<number> {
  const response = await page.request.get(
    `/v1/projects/${encodeURIComponent(projectName)}/spans`
  );
  return (await response.json()).data.length;
}

test.describe("Project evaluator test bench", () => {
  test("Load More keeps the listed spans in place and adds the rest below them", async ({
    page,
  }) => {
    const projectName = `test-bench-${randomUUID().slice(0, 8)}`;
    const projectId = await createProject({ page, projectName });
    const listedSpanNames = makeSpanNames({ prefix: "listed", count: 25 });
    const arrivedSpanNames = makeSpanNames({ prefix: "arrived", count: 5 });
    const nowMs = Date.now();
    await sendRootSpans({
      page,
      projectName,
      spanNames: listedSpanNames,
      firstStartTimeMs: nowMs - 600_000,
    });
    // Span ingestion is asynchronous.
    await expect
      .poll(() => countProjectSpans({ page, projectName }))
      .toBe(listedSpanNames.length);

    await page.goto(`/projects/${projectId}/evaluators/new/decision`);
    const recordNames = page
      .getByRole("table", { name: "Recent matching spans" })
      .getByTitle(/^(listed|arrived)-\d+$/);
    const listedNamesNewestFirst = [...listedSpanNames].reverse();
    const firstPageNames = listedNamesNewestFirst.slice(
      0,
      NUM_RECORDS_PER_PAGE
    );
    await expect(recordNames).toHaveText(firstPageNames);

    await sendRootSpans({
      page,
      projectName,
      spanNames: arrivedSpanNames,
      firstStartTimeMs: nowMs - 60_000,
    });
    await expect
      .poll(() => countProjectSpans({ page, projectName }))
      .toBe(listedSpanNames.length + arrivedSpanNames.length);
    await page.getByRole("button", { name: "Load More" }).click();

    await expect(recordNames).toHaveText([
      ...firstPageNames,
      ...[...arrivedSpanNames].reverse(),
      ...listedNamesNewestFirst.slice(
        NUM_RECORDS_PER_PAGE,
        2 * NUM_RECORDS_PER_PAGE - arrivedSpanNames.length
      ),
    ]);
  });
});
