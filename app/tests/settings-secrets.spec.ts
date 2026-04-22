import { randomUUID } from "crypto";
import { expect, test, type Page, type Response } from "@playwright/test";

function isSecretsMutationResponse(response: Response) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes("SecretsMutationMutation") ?? false;
}

const secretsDialog = (page: Page) => page.getByTestId("dialog");

test.describe("Settings Secrets", () => {
  async function createSecret({
    page,
    key,
    value,
  }: {
    page: Page;
    key: string;
    value: string;
  }) {
    await page.getByRole("button", { name: "New Secret" }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await page.getByRole("textbox", { name: "Key" }).fill(key);
    await page.getByLabel("Value").fill(value);
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Create Secret" }).click(),
    ]);
    await expect(secretsDialog(page)).not.toBeVisible();
  }

  test("can create, replace, and delete a secret", async ({ page }) => {
    const keyInput = `playwright secret ${randomUUID().slice(0, 8)}`;
    const secretKey = keyInput.toUpperCase().replace(/\s+/g, "_");

    await page.goto("/settings/secrets");
    await page.waitForURL("**/settings/secrets");

    const keyField = page.getByRole("textbox", { name: "Key" });
    await page.getByRole("button", { name: "New Secret" }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await keyField.fill(keyInput);
    await expect(keyField).toHaveValue(secretKey);

    await page.getByLabel("Value").fill("initial-secret-value");
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Create Secret" }).click(),
    ]);

    await expect(secretsDialog(page)).not.toBeVisible();

    const row = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: secretKey }),
    });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: `Replace ${secretKey}` }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await expect(page.getByLabel("Value")).toHaveValue("");
    await page.getByLabel("Value").fill("updated-secret-value");
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Save Secret" }).click(),
    ]);

    await expect(secretsDialog(page)).not.toBeVisible();
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: `Delete ${secretKey}` }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Delete Secret" }).click(),
    ]);

    await expect(secretsDialog(page)).not.toBeVisible();
    await expect(row).not.toBeVisible();
  });

  test("supports search, owner filter, and sorting", async ({ page }) => {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const firstSecretKey = `ZZZ_SECRET_${suffix}`;
    const secondSecretKey = `AAA_SECRET_${suffix}`;

    await page.goto("/settings/secrets");
    await page.waitForURL("**/settings/secrets");

    await createSecret({
      page,
      key: firstSecretKey,
      value: "search-secret-value-1",
    });
    await createSecret({
      page,
      key: secondSecretKey,
      value: "search-secret-value-2",
    });

    const row = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: firstSecretKey }),
    });
    await expect(row).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Created By" })
    ).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Search secrets" });
    await search.fill(firstSecretKey);
    await expect(row).toBeVisible();

    await search.fill("definitely-no-match");
    await expect(row).not.toBeVisible();

    await search.fill("");
    await expect(row).toBeVisible();

    await page.getByRole("button", { name: "All" }).click();
    await page.getByRole("option", { name: "Created by me" }).click();
    await expect(row).toBeVisible();

    const keyHeader = page.getByRole("columnheader", { name: "Key" }).first();
    await keyHeader.locator(".sort").click();
    await expect(page.locator("tbody tr td:first-child").first()).toHaveText(
      secondSecretKey
    );

    await row.getByRole("button", { name: `Delete ${firstSecretKey}` }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Delete Secret" }).click(),
    ]);
    await expect(secretsDialog(page)).not.toBeVisible();
    await expect(row).not.toBeVisible();

    const secondRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: secondSecretKey }),
    });
    await secondRow
      .getByRole("button", { name: `Delete ${secondSecretKey}` })
      .click();
    await expect(secretsDialog(page)).toBeVisible();
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Delete Secret" }).click(),
    ]);
    await expect(secretsDialog(page)).not.toBeVisible();
    await expect(secondRow).not.toBeVisible();
  });

  test("does not leak secret values to the DOM or later network requests", async ({
    page,
  }) => {
    const secretKey = `LEAK_TEST_${randomUUID().slice(0, 8).toUpperCase()}`;
    const secretValue = `super-secret-${randomUUID()}`;
    const requestsContainingSecret: string[] = [];

    page.on("request", (request) => {
      const postData = request.postData();
      if (postData?.includes(secretValue)) {
        requestsContainingSecret.push(postData);
      }
    });

    await page.goto("/settings/secrets");
    await page.waitForURL("**/settings/secrets");

    await createSecret({
      page,
      key: secretKey,
      value: secretValue,
    });

    const body = page.locator("body");
    await expect(body).not.toContainText(secretValue);

    const inputValuesAfterCreate = await page
      .locator("input, textarea")
      .evaluateAll((elements) =>
        elements.map((element) => {
          if (element instanceof HTMLInputElement) {
            return element.value;
          }
          if (element instanceof HTMLTextAreaElement) {
            return element.value;
          }
          return "";
        })
      );
    expect(inputValuesAfterCreate).not.toContain(secretValue);

    const row = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: secretKey }),
    });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: `Replace ${secretKey}` }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await expect(page.getByLabel("Value")).toHaveValue("");

    const inputValuesInReplaceDialog = await page
      .locator("input, textarea")
      .evaluateAll((elements) =>
        elements.map((element) => {
          if (element instanceof HTMLInputElement) {
            return element.value;
          }
          if (element instanceof HTMLTextAreaElement) {
            return element.value;
          }
          return "";
        })
      );
    expect(inputValuesInReplaceDialog).not.toContain(secretValue);

    await page.keyboard.press("Escape");
    await expect(secretsDialog(page)).not.toBeVisible();

    await page.getByRole("button", { name: "All" }).click();
    await page.getByRole("option", { name: "Created by me" }).click();
    await page
      .getByRole("searchbox", { name: "Search secrets" })
      .fill(secretKey);
    await page
      .getByRole("columnheader", { name: "Key" })
      .first()
      .locator(".sort")
      .click();

    await expect(body).not.toContainText(secretValue);

    const inputValuesAfterInteractions = await page
      .locator("input, textarea")
      .evaluateAll((elements) =>
        elements.map((element) => {
          if (element instanceof HTMLInputElement) {
            return element.value;
          }
          if (element instanceof HTMLTextAreaElement) {
            return element.value;
          }
          return "";
        })
      );
    expect(inputValuesAfterInteractions).not.toContain(secretValue);

    expect(requestsContainingSecret).toHaveLength(1);

    await row.getByRole("button", { name: `Delete ${secretKey}` }).click();
    await expect(secretsDialog(page)).toBeVisible();
    await Promise.all([
      page.waitForResponse(isSecretsMutationResponse),
      page.getByRole("button", { name: "Delete Secret" }).click(),
    ]);
    await expect(secretsDialog(page)).not.toBeVisible();
    await expect(row).not.toBeVisible();

    expect(requestsContainingSecret).toHaveLength(1);
  });
});
