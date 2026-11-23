import { expect, test, type Page } from "@playwright/test";

/**
 * Every evaluator form shares one layout (EvaluatorFormLayout). These run
 * on the default project's LLM form.
 */
async function openNewLlmEvaluator(page: Page) {
  await page.goto("/projects");
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "default", exact: true }),
    })
    .click();
  await page.waitForURL(/\/projects\/[^/]+/);
  const projectPath = new URL(page.url()).pathname
    .split("/")
    .slice(0, 3)
    .join("/");
  await page.goto(`${projectPath}/evaluators/new/llm`);
  const dialog = page.getByRole("dialog", { name: "New LLM evaluator" });
  await expect(dialog).toBeVisible();
  // The test bench's inspector is the last panel to settle.
  await expect(
    dialog.getByRole("heading", { name: "Evaluator inputs" })
  ).toBeVisible();
  return dialog;
}

test.describe("evaluator form", () => {
  test("keeps the mapping panel collapsed across a reload", async ({
    page,
  }) => {
    const dialog = await openNewLlmEvaluator(page);
    const variables = dialog.getByRole("button", { name: /^Variables/ });
    await expect(variables).toHaveAttribute("aria-expanded", "true");

    await variables.click();
    await expect(variables).toHaveAttribute("aria-expanded", "false");

    await page.reload();
    await expect(
      page
        .getByRole("dialog", { name: "New LLM evaluator" })
        .getByRole("button", { name: /^Variables/ })
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("a failed create shows the invalid field in its tab", async ({
    page,
  }) => {
    const dialog = await openNewLlmEvaluator(page);
    await dialog.getByLabel("Name").first().fill("annotation-check");
    await dialog.getByRole("tab", { name: "Annotation" }).click();
    const choice = dialog
      .getByRole("tabpanel", { name: "Annotation" })
      .getByRole("textbox")
      .and(dialog.locator("input:not([disabled])"))
      .first();
    await choice.fill("");
    // The choice is out of sight once another tab is selected.
    await dialog.getByRole("tab", { name: "Scope" }).click();

    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    const annotationTab = dialog.getByRole("tab", { name: /^Annotation/ });
    await expect(annotationTab).toHaveAttribute("aria-selected", "true");
    await expect(annotationTab.getByLabel("Has errors")).toBeVisible();
    await expect(choice).toBeFocused();
  });
});
