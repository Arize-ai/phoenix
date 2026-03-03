import { randomUUID } from "crypto";
import { expect, test, type Response } from "@playwright/test";

function isGraphQLMutationResponse(response: Response, operationName: string) {
  if (!response.url().includes("/graphql") || response.status() !== 200) {
    return false;
  }
  const postData = response.request().postData();
  return postData?.includes(operationName) ?? false;
}

test.describe("Settings Labels Tables", () => {
  test("can create and render prompt labels in settings table", async ({
    page,
  }) => {
    const labelName = `prompt-label-${randomUUID().slice(0, 8)}`;

    await page.goto("/settings/prompts");
    await page.waitForURL("**/settings/prompts");

    await page.getByRole("button", { name: "New Label" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Label Name").fill(labelName);
    await page
      .getByLabel("Description")
      .fill("Prompt label for compiler e2e coverage");
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(resp, "NewPromptLabelDialogMutation")
      ),
      page.getByRole("button", { name: "Create Label" }).click(),
    ]);

    await expect(page.getByRole("dialog")).not.toBeVisible();
    const row = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: labelName }),
    });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("button", { name: "Delete Prompt Label" })
    ).toBeVisible();
  });

  test("can create and render dataset labels in settings table", async ({
    page,
  }) => {
    const labelName = `dataset-label-${randomUUID().slice(0, 8)}`;

    await page.goto("/settings/datasets");
    await page.waitForURL("**/settings/datasets");

    await page.getByRole("button", { name: "New Label" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Label Name").fill(labelName);
    await page
      .getByLabel("Description")
      .fill("Dataset label for compiler e2e coverage");
    await Promise.all([
      page.waitForResponse((resp) =>
        isGraphQLMutationResponse(
          resp,
          "useDatasetLabelMutationsAddLabelMutation"
        )
      ),
      page.getByRole("button", { name: "Create Label" }).click(),
    ]);

    await expect(page.getByRole("dialog")).not.toBeVisible();
    const row = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: labelName }),
    });
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("button", { name: "Delete Dataset Label" })
    ).toBeVisible();
  });
});
