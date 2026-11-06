# Phoenix Playwright Test Examples

Complete examples from the Phoenix test suite.

## Example 1: Basic CRUD Test (Prompt Management)

```typescript
import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.describe("Prompt Management", () => {
  test.beforeEach(async ({ page }) => {
    page.goto(`/login`);
    await page.getByLabel("Email").fill("admin@localhost");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL("**/projects");
  });

  test("can create a prompt", async ({ page }) => {
    await page.goto("/prompts");
    await page.waitForURL("**/prompts");
    await page.getByRole("link", { name: "New Prompt" }).click();
    await page.waitForURL("**/playground");
    await page
      .getByText("You are a chatbot")
      .fill("You are a helpful assistant");
    await page.getByRole("button", { name: "Save Prompt" }).click();
    await page.getByPlaceholder("Select or enter new prompt").click();
    const promptName = `chatbot-${randomUUID()}`;
    await page.getByPlaceholder("Select or enter new prompt").fill(promptName);
    await page.getByLabel("Prompt Description").click();
    await page.getByLabel("Prompt Description").fill("very kind chatbot");
    await page.getByRole("button", { name: "Create Prompt" }).click();
    await page.getByRole("button", { name: "View Prompt" }).click();

    await expect(page.getByRole("heading", { name: promptName })).toBeVisible();
    await expect(
      page.getByText("You are a helpful assistant").first()
    ).toBeVisible();
  });
});
```

## Example 2: User Management (Admin Actions)

```typescript
import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.beforeEach(async ({ page }) => {
  page.goto(`/login`);
  await page.getByLabel("Email").fill("admin@localhost");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/projects");
});

test("can create a user", async ({ page }) => {
  await page.goto("/settings/general");
  await page.waitForURL("**/settings/general");
  await page.getByRole("button", { name: "Add User" }).click();

  const email = `member-${randomUUID()}@localhost.com`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("member123");
  await page.getByLabel("Confirm Password").fill("member123");
  await page.getByRole("dialog").getByLabel("member", { exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("option", { name: "member" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add User" })
    .click();

  await expect(page.getByRole("cell", { name: email })).toBeVisible();
});
```

## Example 3: Serial Tests with Shared State (Evaluators)

```typescript
import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

test.describe.serial("Server Evaluators", () => {
  const datasetName = `test-dataset-${randomUUID()}`;
  const customEvaluatorName = `custom-eval-${randomUUID().slice(0, 8)}`;
  const updatedDescription = "Updated description for testing";

  test.beforeEach(async ({ page }) => {
    await page.goto(`/login`);
    await page.getByLabel("Email").fill("admin@localhost");
    await page.getByLabel("Password").fill("admin123");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL("**/projects");
  });

  test("can create a dataset", async ({ page }) => {
    await page.goto("/datasets");
    await page.waitForURL("**/datasets");

    await page.getByRole("button", { name: "New Dataset" }).click();
    await page.getByRole("menuitem", { name: "New Dataset" }).click();

    await page.getByLabel("Dataset Name").clear();
    await page.getByLabel("Dataset Name").fill(datasetName);
    await page.getByLabel("Description").fill("Test dataset for evaluators");

    await page.getByRole("button", { name: "Create Dataset" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("link", { name: datasetName })).toBeVisible({
      timeout: 10000,
    });
  });

  test("can create a custom LLM evaluator", async ({ page }) => {
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    await page.getByRole("button", { name: "Add evaluator" }).click();
    await page
      .getByRole("menuitem", { name: "Create new LLM evaluator" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Create Evaluator" })
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "Name" })
      .first()
      .fill(customEvaluatorName);
    await page
      .getByRole("textbox", { name: /Description/i })
      .fill("Initial description for custom evaluator");

    const systemSection = page.locator(
      'button:has-text("System"):not([role="menuitem"])'
    );
    const systemTextbox = systemSection
      .locator("..")
      .locator("..")
      .getByRole("textbox");
    await systemTextbox.fill("You are an evaluator.");

    const userSection = page.locator(
      'button:has-text("User"):not([role="menuitem"])'
    );
    const userTextbox = userSection
      .locator("..")
      .locator("..")
      .getByRole("textbox");
    await userTextbox.fill("Evaluate: {{output}}");

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("cell", { name: customEvaluatorName })
    ).toBeVisible();
  });

  test("can edit an LLM evaluator", async ({ page }) => {
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: customEvaluatorName }),
    });
    await evaluatorRow.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    await expect(
      page.getByRole("heading", { name: "Edit Evaluator" })
    ).toBeVisible();

    const descriptionInput = page.getByRole("textbox", {
      name: /Description/i,
    });
    await descriptionInput.clear();
    await descriptionInput.fill(updatedDescription);

    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("cell", { name: customEvaluatorName })
    ).toBeVisible();
  });

  test("can verify edits were saved", async ({ page }) => {
    await page.goto("/datasets");
    await page.getByRole("link", { name: datasetName }).click();
    await page.waitForURL("**/datasets/**/examples");
    await page.getByRole("tab", { name: /Evaluators/i }).click();
    await page.waitForURL("**/evaluators");

    const evaluatorRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: customEvaluatorName }),
    });
    await evaluatorRow.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const descriptionInput = page.getByRole("textbox", {
      name: /Description/i,
    });
    await expect(descriptionInput).toHaveValue(updatedDescription);

    await page.getByRole("button", { name: "Cancel" }).click();
  });
});
```

## Example 4: Role-Based Access Control

```typescript
import { expect, test } from "@playwright/test";

test.describe("Viewer Access", () => {
  test.beforeEach(async ({ page }) => {
    page.goto(`/login`);
    await page.getByLabel("Email").fill("viewer@localhost.com");
    await page.getByLabel("Password").fill("viewer123");
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL("**/projects");
  });

  test("viewer cannot access settings", async ({ page }) => {
    await page.goto("/settings/general");
    // Viewer should be redirected or see access denied
    await expect(page.getByText("Access Denied")).toBeVisible();
  });
});
```

## Example 5: Testing with Playground Integration

```typescript
test("evaluators are visible in playground when dataset is selected", async ({
  page,
}) => {
  await page.goto("/datasets");
  await page.getByRole("link", { name: datasetName }).click();
  await page.waitForURL("**/datasets/**/examples");

  const datasetUrl = page.url();
  const datasetIdMatch = datasetUrl.match(/datasets\/([^/]+)/);
  const datasetIdForUrl = datasetIdMatch ? datasetIdMatch[1] : "";

  await page.goto(`/playground?datasetId=${datasetIdForUrl}`);
  await page.waitForURL("**/playground**");

  await expect(
    page.getByRole("button", { name: new RegExp(datasetName) })
  ).toBeVisible();

  await expect(page.getByRole("heading", { name: "Experiment" })).toBeVisible();

  const experimentSection = page.locator("text=Experiment").locator("..");
  await expect(
    experimentSection.getByRole("button", { name: "Evaluators" })
  ).toBeVisible();
});
```
