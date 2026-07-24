import { expect, test, type Page } from "@playwright/test";

async function openAssistant(page: Page) {
  await page.getByRole("button", { name: "Ask PXI" }).click();
  const rail = page.getByRole("complementary", { name: "Assistant" });
  await expect(rail).toBeVisible();
  const acknowledgeButton = rail.getByRole("button", { name: "Acknowledge" });
  const input = rail.getByPlaceholder("Send a message...");
  await expect(acknowledgeButton.or(input)).toBeVisible();
  if (await acknowledgeButton.isVisible()) {
    await acknowledgeButton.click();
  }
  await expect(input).toBeVisible();
  return rail;
}

test.describe("application frame overlays", () => {
  test.skip(
    process.env.APP_FRAME_E2E !== "true",
    "runs in the dedicated assistant-enabled app-frame project"
  );

  test("Tier 1 keeps the rail collaborative and restores focus", async ({
    page,
  }) => {
    await page.goto("/datasets");
    const rail = await openAssistant(page);
    const railInput = rail.getByPlaceholder("Send a message...");
    await rail.evaluate((element) => {
      element.setAttribute("data-e2e-identity", "persistent-rail");
    });
    await railInput.fill("draft survives viewport modality");

    const trigger = page.getByTestId("create-dataset-button");
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Create Dataset" });
    await expect(dialog).toBeVisible();
    await expect(
      page.getByTestId("application-side-navigation")
    ).toHaveAttribute("inert", "");
    await expect(
      page.getByTestId("application-top-navigation")
    ).toHaveAttribute("inert", "");
    await expect(page.getByTestId("content")).toHaveAttribute("inert", "");
    await expect(page.getByTestId("application-drawer-plane")).toHaveAttribute(
      "inert",
      ""
    );
    await expect(
      page.getByTestId("application-viewport-modal-plane")
    ).not.toHaveAttribute("inert", "");
    await expect(rail).not.toHaveAttribute("inert", "");
    expect(
      await rail.evaluate((element) => element.closest("[inert]") == null)
    ).toBe(true);
    await expect(dialog).not.toHaveAttribute("aria-modal", "true");

    await dialog.getByRole("tab", { name: "From scratch" }).click();
    await dialog.getByLabel("Dataset Name").fill("collaborative draft");
    await railInput.focus();
    await expect(railInput).toBeFocused();
    await railInput.press("Escape");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Dataset Name").focus();
    await dialog.getByLabel("Dataset Name").press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId("content")).not.toHaveAttribute("inert", "");
    await expect(trigger).toBeFocused();
    await expect(rail).toHaveAttribute("data-e2e-identity", "persistent-rail");
    await expect(railInput).toHaveValue("draft survives viewport modality");
  });

  test("a drawer belongs to the page-content row and never crosses the rail", async ({
    page,
  }) => {
    await page.goto("/settings/users");
    const rail = await openAssistant(page);
    const railInput = rail.getByPlaceholder("Send a message...");
    await rail.evaluate((element) => {
      element.setAttribute("data-e2e-identity", "persistent-rail");
    });
    await railInput.fill("draft survives drawer navigation");

    await page.getByRole("link", { name: "member", exact: true }).click();
    const drawer = page.getByRole("complementary", {
      name: "Detail drawer",
    });
    await expect(drawer).toBeVisible();
    await drawer.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished)
      );
    });

    const [contentGeometry, drawerGeometry, railGeometry, viewportGeometry] =
      await Promise.all([
        page.getByTestId("content").boundingBox(),
        drawer.boundingBox(),
        rail.boundingBox(),
        page.getByTestId("application-viewport").boundingBox(),
      ]);

    expect(contentGeometry).not.toBeNull();
    expect(drawerGeometry).not.toBeNull();
    expect(railGeometry).not.toBeNull();
    expect(viewportGeometry).not.toBeNull();

    expect(drawerGeometry!.y).toBeCloseTo(contentGeometry!.y, 0);
    expect(drawerGeometry!.y + drawerGeometry!.height).toBeCloseTo(
      contentGeometry!.y + contentGeometry!.height,
      0
    );
    expect(drawerGeometry!.x + drawerGeometry!.width).toBeCloseTo(
      viewportGeometry!.x + viewportGeometry!.width,
      0
    );
    expect(drawerGeometry!.x + drawerGeometry!.width).toBeLessThanOrEqual(
      railGeometry!.x
    );

    const resizeHandle = drawer.getByRole("separator", {
      name: "Resize drawer",
    });
    await resizeHandle.focus();
    await resizeHandle.press("End");

    const [maximumDrawerGeometry, maximumViewportGeometry] = await Promise.all([
      drawer.boundingBox(),
      page.getByTestId("application-viewport").boundingBox(),
    ]);
    expect(
      maximumViewportGeometry!.width - maximumDrawerGeometry!.width
    ).toBeCloseTo(80, 0);

    await expect(rail).toHaveAttribute("data-e2e-identity", "persistent-rail");
    await expect(railInput).toHaveValue("draft survives drawer navigation");
  });
});
