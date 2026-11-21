import { expect, test, type Page } from "@playwright/test";

/**
 * The LLM evaluator forms are laid out as a workspace of tabs. These run on
 * the default project's form; the dataset form shares the workspace.
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

/** The tabset that holds the given tab. */
function tabsetOf(page: Page, tabName: string) {
  return page
    .locator("[data-tabset]")
    .filter({ has: page.getByRole("tab", { name: tabName }) });
}

test.describe("evaluator workspace", () => {
  test("keeps the arrangement across a reload until it is reset", async ({
    page,
  }) => {
    let dialog = await openNewLlmEvaluator(page);
    const variables = tabsetOf(page, "Variables");
    await expect(variables).not.toHaveAttribute("data-tabset-collapsed");

    await variables.getByRole("button", { name: "Collapse panel" }).click();
    await expect(variables).toHaveAttribute("data-tabset-collapsed");

    await page.reload();
    dialog = page.getByRole("dialog", { name: "New LLM evaluator" });
    await expect(dialog).toBeVisible();
    await expect(tabsetOf(page, "Variables")).toHaveAttribute(
      "data-tabset-collapsed"
    );

    await dialog.getByRole("button", { name: "Reset layout" }).click();
    await expect(tabsetOf(page, "Variables")).not.toHaveAttribute(
      "data-tabset-collapsed"
    );

    // The reset is saved too.
    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "New LLM evaluator" })
    ).toBeVisible();
    await expect(tabsetOf(page, "Variables")).not.toHaveAttribute(
      "data-tabset-collapsed"
    );
  });

  test("reaches tabs that do not fit from the more tabs menu", async ({
    page,
  }) => {
    await openNewLlmEvaluator(page);
    // Narrow the definition tabset to its minimum width by dragging the
    // divider between the two columns.
    const divider = page.locator('[data-split-id="root"] > [data-separator]');
    const box = await divider.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x - 600, box!.y + box!.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    const definition = tabsetOf(page, "Prompt");
    const moreTabs = definition.getByRole("button", { name: /more tabs$/ });
    await moreTabs.click();
    const menu = page.getByRole("menu", { name: "More tabs" });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Details" }).click();
    await expect(
      definition.getByRole("tab", { name: "Details" })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("a failed create shows the invalid field in its tab", async ({
    page,
  }) => {
    const dialog = await openNewLlmEvaluator(page);
    await dialog.getByRole("tab", { name: "Details" }).click();
    const name = dialog
      .getByRole("tabpanel", { name: "Details" })
      .getByLabel("Name");
    await name.fill("");
    // The name is out of sight once another tab is selected.
    await dialog.getByRole("tab", { name: "Prompt" }).click();

    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    await expect(dialog.getByRole("tab", { name: "Details" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(name).toBeFocused();
  });
});
