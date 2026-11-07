import { randomUUID } from "crypto";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

const SUFFIX = randomUUID().slice(0, 8);
const GPT_HOT = `gpt-hot-${SUFFIX}`;
const GPT_COLD = `gpt-cold-${SUFFIX}`;
const CLAUDE = `claude-${SUFFIX}`;
const ALL_EXPERIMENTS = [GPT_HOT, GPT_COLD, CLAUDE];

async function createDatasetWithExperiments(
  request: APIRequestContext
): Promise<{ datasetId: string; datasetName: string }> {
  const datasetName = `experiment-filter-${SUFFIX}`;
  const createDatasetResponse = await request.post(
    "/v1/datasets/upload?sync=true",
    {
      data: {
        action: "create",
        name: datasetName,
        inputs: [{ question: "What is 2+2?" }],
        outputs: [{ answer: "4" }],
      },
    }
  );
  expect(createDatasetResponse.ok()).toBeTruthy();
  const datasetId: string = (await createDatasetResponse.json()).data
    .dataset_id;
  const metadataByName = {
    [GPT_HOT]: { model: "gpt-5", temperature: 0.7 },
    [GPT_COLD]: { model: "gpt-5", temperature: 0 },
    [CLAUDE]: { model: "claude", temperature: 1 },
  };
  for (const [name, metadata] of Object.entries(metadataByName)) {
    const response = await request.post(
      `/v1/datasets/${datasetId}/experiments`,
      { data: { name, metadata } }
    );
    expect(response.ok()).toBeTruthy();
  }
  return { datasetId, datasetName };
}

function filterField(page: Page) {
  return page.getByRole("textbox", { name: "Filter experiments" });
}

async function expectExperiments(page: Page, names: string[]) {
  for (const name of ALL_EXPERIMENTS) {
    const link = page.getByRole("link", { name, exact: true });
    if (names.includes(name)) {
      await expect(link).toBeVisible();
    } else {
      await expect(link).toHaveCount(0);
    }
  }
}

function urlFilterCondition(page: Page): string | null {
  return new URL(page.url()).searchParams.get("experimentFilterCondition");
}

test.describe("Experiments filter condition", () => {
  let datasetId: string;
  let datasetName: string;

  test.beforeAll(async ({ request }) => {
    ({ datasetId, datasetName } = await createDatasetWithExperiments(request));
  });

  test("filters by a typed condition, keeps it in the URL, and composes with search", async ({
    page,
  }) => {
    await page.goto(`/datasets/${datasetId}/experiments`);
    await expectExperiments(page, ALL_EXPERIMENTS);

    await filterField(page).click();
    await page.keyboard.type('metadata["model"] == "gpt-5"');
    await page.keyboard.press("Escape");
    await expectExperiments(page, [GPT_HOT, GPT_COLD]);
    await expect
      .poll(() => urlFilterCondition(page))
      .toBe('metadata["model"] == "gpt-5"');

    await page
      .getByRole("searchbox", { name: "Search experiments" })
      .fill("cold");
    await expectExperiments(page, [GPT_COLD]);

    await page.reload();
    await expect(filterField(page)).toHaveText('metadata["model"] == "gpt-5"');
    await expectExperiments(page, [GPT_HOT, GPT_COLD]);
  });

  test("adds a Metadata form match to the condition", async ({ page }) => {
    await page.goto(
      `/datasets/${datasetId}/experiments?experimentFilterCondition=${encodeURIComponent(
        'metadata["model"] == "gpt-5"'
      )}`
    );
    await expectExperiments(page, [GPT_HOT, GPT_COLD]);

    await page
      .getByRole("button", { name: "Filter experiments by metadata" })
      .click();
    await page.getByLabel("Key").fill("temperature");
    await page.getByLabel("Value").fill("0.7");
    await page.getByRole("button", { name: "Add filter" }).click();

    await expect(filterField(page)).toHaveText(
      '(metadata["model"] == "gpt-5") and (metadata["temperature"] == 0.7)'
    );
    await expectExperiments(page, [GPT_HOT]);
  });

  test("says No results when the condition matches nothing", async ({
    page,
  }) => {
    await page.goto(
      `/datasets/${datasetId}/experiments?experimentFilterCondition=${encodeURIComponent(
        'metadata["model"] == "missing"'
      )}`
    );
    await expect(page.getByText("No results")).toBeVisible();
  });

  test("shows a rejected URL condition in the field over an unfiltered table", async ({
    page,
  }) => {
    await page.goto(
      `/datasets/${datasetId}/experiments?experimentFilterCondition=${encodeURIComponent(
        "repetitions >"
      )}`
    );
    await expectExperiments(page, ALL_EXPERIMENTS);
    await expect(filterField(page)).toHaveText("repetitions >");
    await expect(
      page.getByRole("button", { name: "Filter condition error" })
    ).toBeVisible();
    expect(urlFilterCondition(page)).toBe("repetitions >");

    await page.getByRole("button", { name: "Clear filter condition" }).click();
    await expect.poll(() => urlFilterCondition(page)).toBeNull();
    await page.reload();
    await expect(filterField(page)).not.toHaveText("repetitions >");
    await expectExperiments(page, ALL_EXPERIMENTS);
  });

  test("keeps the condition in the URL after the dataset breadcrumb", async ({
    page,
  }) => {
    const condition = 'metadata["model"] == "claude"';
    await page.goto(
      `/datasets/${datasetId}/experiments?experimentFilterCondition=${encodeURIComponent(
        condition
      )}`
    );
    await expectExperiments(page, [CLAUDE]);

    await page.getByRole("link", { name: datasetName, exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/datasets/${datasetId}`);
    await expect.poll(() => urlFilterCondition(page)).toBe(condition);
    await expectExperiments(page, [CLAUDE]);
  });
});
