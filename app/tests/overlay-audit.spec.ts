import { randomUUID } from "crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Overlay behavior audit.
 *
 * The application frame separates overlay surfaces into tiers:
 *
 * - Tier 1 (viewport modal): blocks only the application viewport. The
 *   pinned assistant rail stays an ordinary, interactive sibling. Rendered
 *   into the `application-viewport-modal-plane`, never `aria-modal`.
 * - Tier 2 (window modal): blocks the entire window, assistant included.
 *   Portaled to `document.body` with a full-window backdrop.
 * - Non-modal floating UI (menus, popovers, selects): no scroll lock, no
 *   aria-hiding. Outside presses dismiss and are consumed so they cannot
 *   also activate whatever sits beneath.
 *
 * Every test here audits one contract of those tiers against production
 * surfaces: stacking/plane membership, backdrop dismissal, Escape ordering,
 * click containment, and focus restoration.
 */

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

/** Clicks the dimmed backdrop of the active viewport modal overlay. */
async function clickViewportModalBackdrop(page: Page) {
  const overlay = page.getByTestId("viewport-modal-overlay");
  const box = await overlay.boundingBox();
  expect(box).not.toBeNull();
  // Bottom-left corner of the overlay is page content, far away from any
  // centered dialog.
  await overlay.click({ position: { x: 8, y: box!.height - 8 } });
}

async function createDataset(page: Page, name: string) {
  await page.goto("/datasets");
  await page.getByTestId("create-dataset-button").click();
  const dialog = page.getByRole("dialog", { name: "Create Dataset" });
  await dialog.getByRole("tab", { name: "From scratch" }).click();
  await dialog.getByLabel("Dataset Name").fill(name);
  await dialog.getByRole("button", { name: "Create Dataset" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
}

function datasetRow(page: Page, name: string) {
  return page
    .getByTestId("datasets-table")
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
}

type ViewportDialogCase = {
  /** Route the trigger lives on. */
  route: string;
  /** Accessible dialog name to await. */
  dialogName: string;
  /** Locates the trigger that opens the dialog. */
  trigger: (page: Page) => Locator;
  /**
   * Whether Escape/backdrop dismissal must land focus back on the trigger.
   * Dialogs whose open state lives outside DialogTrigger may restore focus
   * asynchronously; they still must not leave focus trapped.
   */
  restoresFocus?: boolean;
};

const viewportDialogCases: Record<string, ViewportDialogCase> = {
  "Create Dataset": {
    route: "/datasets",
    dialogName: "Create Dataset",
    trigger: (page) => page.getByTestId("create-dataset-button"),
    restoresFocus: true,
  },
  "New project": {
    route: "/projects",
    dialogName: "New project",
    trigger: (page) => page.getByTestId("create-project-button"),
    restoresFocus: true,
  },
  "Add User": {
    route: "/settings/users",
    dialogName: "Add User",
    trigger: (page) => page.getByRole("button", { name: "Add User" }),
    restoresFocus: true,
  },
  "New Retention Policy": {
    route: "/settings/data",
    dialogName: "New Retention Policy",
    trigger: (page) => page.getByRole("button", { name: "New Policy" }),
    restoresFocus: true,
  },
  "Create an API Key": {
    route: "/settings/api-keys",
    dialogName: "Create an API Key",
    trigger: (page) =>
      page.getByRole("button", { name: "System Key", exact: true }),
    restoresFocus: true,
  },
  "Create Secret": {
    route: "/settings/secrets",
    dialogName: "Create Secret",
    trigger: (page) => page.getByRole("button", { name: "New Secret" }),
  },
  "Create New Model": {
    route: "/settings/models",
    dialogName: "Create New Model",
    trigger: (page) => page.getByRole("button", { name: "Create a new model" }),
  },
};

test.describe("overlay audit", () => {
  test.skip(
    process.env.APP_FRAME_E2E !== "true",
    "runs in the dedicated assistant-enabled app-frame project"
  );

  test.describe("viewport dialogs (Tier 1)", () => {
    for (const [title, dialogCase] of Object.entries(viewportDialogCases)) {
      test(`${title} honors the viewport dialog contract`, async ({ page }) => {
        await page.goto(dialogCase.route);
        const trigger = dialogCase.trigger(page);
        await trigger.click();

        const dialog = page.getByRole("dialog", {
          name: dialogCase.dialogName,
        });
        await expect(dialog).toBeVisible();

        // Owned by the viewport modal plane, not the document body.
        expect(
          await dialog.evaluate(
            (element) =>
              element.closest(
                '[data-testid="application-viewport-modal-plane"]'
              ) != null
          )
        ).toBe(true);

        // Blocks the viewport without declaring window modality.
        await expect(dialog).not.toHaveAttribute("aria-modal", "true");
        await expect(page.getByTestId("content")).toHaveAttribute("inert", "");
        await expect(
          page.getByTestId("application-side-navigation")
        ).toHaveAttribute("inert", "");

        // The assistant control remains reachable while the dialog is open.
        const assistantButton = page.getByRole("button", { name: "Ask PXI" });
        expect(
          await assistantButton.evaluate(
            (element) => element.closest("[inert]") == null
          )
        ).toBe(true);

        // Clicking inside the dialog must not dismiss it.
        await dialog
          .getByRole("heading", { name: dialogCase.dialogName })
          .click();
        await expect(dialog).toBeVisible();

        // A backdrop press dismisses.
        await clickViewportModalBackdrop(page);
        await expect(dialog).not.toBeVisible();
        await expect(page.getByTestId("content")).not.toHaveAttribute(
          "inert",
          ""
        );

        // Escape dismisses and unblocks the viewport again.
        await trigger.click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(page.getByTestId("content")).not.toHaveAttribute(
          "inert",
          ""
        );

        if (dialogCase.restoresFocus) {
          await expect(trigger).toBeFocused();
        } else {
          // Focus must never remain trapped in a removed dialog.
          expect(
            await page.evaluate(
              () => document.activeElement?.closest('[role="dialog"]') == null
            )
          ).toBe(true);
        }
      });
    }

    test("a viewport dialog leaves the pinned assistant collaborative", async ({
      page,
    }) => {
      await page.goto("/settings/users");
      const rail = await openAssistant(page);
      const railInput = rail.getByPlaceholder("Send a message...");
      await railInput.fill("audit draft");

      await page.getByRole("button", { name: "Add User" }).click();
      const dialog = page.getByRole("dialog", { name: "Add User" });
      await expect(dialog).toBeVisible();

      // The rail is not blocked, keeps its draft, and typing works.
      await expect(rail).not.toHaveAttribute("inert", "");
      await railInput.focus();
      await railInput.fill("audit draft still editable");
      await expect(railInput).toHaveValue("audit draft still editable");

      // A press on the rail does not dismiss the dialog.
      await railInput.click();
      await expect(dialog).toBeVisible();

      // Escape inside the rail dismisses nothing in the viewport.
      await railInput.press("Escape");
      await expect(dialog).toBeVisible();

      // Escape with focus back inside the dialog dismisses it.
      await dialog.getByLabel("Email").click();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    });

    test("Escape closes the innermost overlay of a viewport dialog first", async ({
      page,
    }) => {
      await page.goto("/settings/users");
      await page.getByRole("button", { name: "Add User" }).click();
      const dialog = page.getByRole("dialog", { name: "Add User" });
      await expect(dialog).toBeVisible();

      // Open the role select popover inside the dialog.
      await dialog.getByRole("button", { name: /Role/ }).click();
      const listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible();

      // First Escape dismisses the select popover only.
      await page.keyboard.press("Escape");
      await expect(listbox).not.toBeVisible();
      await expect(dialog).toBeVisible();

      // Second Escape dismisses the dialog.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    });

    test("a select popover inside a viewport dialog stacks above the dialog", async ({
      page,
    }) => {
      await page.goto("/settings/users");
      await page.getByRole("button", { name: "Add User" }).click();
      const dialog = page.getByRole("dialog", { name: "Add User" });
      await expect(dialog).toBeVisible();

      await dialog.getByRole("button", { name: /Role/ }).click();
      const listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible();

      // The topmost element at the listbox's center is inside the listbox —
      // clicks are forwarded to the popover, not the dialog beneath it.
      const option = listbox.getByRole("option").first();
      expect(
        await option.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const top = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
          return element.contains(top) || top === element;
        })
      ).toBe(true);

      // Selecting an option works and leaves the dialog open.
      await option.click();
      await expect(listbox).not.toBeVisible();
      await expect(dialog).toBeVisible();
    });
  });

  test.describe("window modals (Tier 2)", () => {
    test("a destructive confirmation blocks the entire window", async ({
      page,
    }) => {
      const datasetName = `overlay-audit-${randomUUID().slice(0, 8)}`;
      await createDataset(page, datasetName);
      const rail = await openAssistant(page);

      await datasetRow(page, datasetName)
        .getByRole("button", { name: "Dataset actions" })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();

      const dialog = page.getByRole("dialog", { name: "Delete Dataset" });
      await expect(dialog).toBeVisible();

      // Window modality: portaled outside the viewport modal plane with a
      // full-window backdrop and aria-modal semantics.
      expect(
        await dialog.evaluate(
          (element) =>
            element.closest(
              '[data-testid="application-viewport-modal-plane"]'
            ) == null
        )
      ).toBe(true);

      const overlayBox = await page.getByTestId("modal-overlay").boundingBox();
      const viewportSize = page.viewportSize();
      expect(overlayBox).not.toBeNull();
      expect(overlayBox!.width).toBeCloseTo(viewportSize!.width, 0);
      expect(overlayBox!.height).toBeCloseTo(viewportSize!.height, 0);

      // The assistant rail sits beneath the window modal's backdrop: the
      // topmost element at the rail's center is not the rail.
      expect(
        await rail.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const top = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
          return top != null && element.contains(top);
        })
      ).toBe(false);

      // Escape dismisses the confirmation without deleting.
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole("link", { name: datasetName, exact: true })
      ).toBeVisible();

      // Backdrop press also dismisses.
      await datasetRow(page, datasetName)
        .getByRole("button", { name: "Dataset actions" })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(dialog).toBeVisible();
      await page
        .getByTestId("modal-overlay")
        .click({ position: { x: 8, y: 8 } });
      await expect(dialog).not.toBeVisible();

      // Clean up: actually delete the throwaway dataset.
      await datasetRow(page, datasetName)
        .getByRole("button", { name: "Dataset actions" })
        .click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await dialog.getByRole("button", { name: "Delete Dataset" }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe("menus and popovers", () => {
    test("a MenuContainer menu is non-modal and contains its dismissing press", async ({
      page,
    }) => {
      await page.goto("/datasets");
      const accountTrigger = page.getByRole("button", { name: "Account" });
      await accountTrigger.click();
      const menu = page.getByRole("menu", { name: "Account" });
      await expect(menu).toBeVisible();

      // Non-modal: no scroll lock while the menu is open.
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).overflow
        )
      ).not.toBe("hidden");
      // Non-modal: the page is not aria-hidden behind the menu.
      expect(
        await page
          .getByTestId("content")
          .evaluate(
            (element) =>
              element.closest('[aria-hidden="true"]') == null &&
              element.getAttribute("aria-hidden") !== "true"
          )
      ).toBe(true);

      // The press that dismisses the menu is consumed: clicking the create
      // dataset button underneath closes the menu without opening its dialog.
      await page.getByTestId("create-dataset-button").click({ force: true });
      await expect(menu).not.toBeVisible();
      await expect(
        page.getByRole("dialog", { name: "Create Dataset" })
      ).not.toBeVisible();

      // Escape closes the menu and returns focus to its trigger.
      await accountTrigger.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).not.toBeVisible();
      await expect(accountTrigger).toBeFocused();
    });

    test("a row action menu dismisses without activating what sits beneath", async ({
      page,
    }) => {
      const datasetName = `overlay-audit-${randomUUID().slice(0, 8)}`;
      await createDataset(page, datasetName);

      const menuTrigger = datasetRow(page, datasetName).getByRole("button", {
        name: "Dataset actions",
      });
      await menuTrigger.click();
      const menu = page.getByRole("menu", { name: "Dataset actions" });
      await expect(menu).toBeVisible();

      // The press that dismisses the menu must not also follow the dataset
      // link underneath.
      await page
        .getByRole("link", { name: datasetName, exact: true })
        .click({ force: true });
      await expect(menu).not.toBeVisible();
      await expect(page).toHaveURL(/\/datasets$/);

      // Escape closes the menu and returns focus to its trigger.
      await menuTrigger.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).not.toBeVisible();
      await expect(menuTrigger).toBeFocused();

      // Clean up the throwaway dataset.
      await menuTrigger.click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      const dialog = page.getByRole("dialog", { name: "Delete Dataset" });
      await dialog.getByRole("button", { name: "Delete Dataset" }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("a submenu opens beside its trigger item and keeps the root open", async ({
      page,
    }) => {
      const datasetName = `overlay-audit-${randomUUID().slice(0, 8)}`;
      await createDataset(page, datasetName);

      const menuTrigger = datasetRow(page, datasetName).getByRole("button", {
        name: "Dataset actions",
      });
      await menuTrigger.click();
      const rootMenu = page.getByRole("menu", { name: "Dataset actions" });
      await expect(rootMenu).toBeVisible();

      const labelItem = page.getByRole("menuitem", { name: "Label" });
      await labelItem.hover();

      // The submenu popover appears without closing the root menu.
      const submenu = page.locator(".react-aria-Popover").nth(1);
      await expect(submenu).toBeVisible();
      await expect(rootMenu).toBeVisible();

      // Side placement: the submenu does not sit below its trigger item.
      const [itemBox, submenuBox] = await Promise.all([
        labelItem.boundingBox(),
        submenu.boundingBox(),
      ]);
      expect(itemBox).not.toBeNull();
      expect(submenuBox).not.toBeNull();
      // Opens to the side: horizontal separation from the trigger item.
      expect(
        submenuBox!.x + submenuBox!.width <= itemBox!.x + 1 ||
          submenuBox!.x >= itemBox!.x + itemBox!.width - 1
      ).toBe(true);

      // Escape always dismisses the submenu; whether the root closes in the
      // same press depends on where focus sits, but a second press must
      // always finish the job.
      await page.keyboard.press("Escape");
      await expect(submenu).not.toBeVisible();
      if (await rootMenu.isVisible()) {
        await page.keyboard.press("Escape");
      }
      await expect(rootMenu).not.toBeVisible();

      // Clean up the throwaway dataset.
      await menuTrigger.click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      const dialog = page.getByRole("dialog", { name: "Delete Dataset" });
      await dialog.getByRole("button", { name: "Delete Dataset" }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("a menu opened from the assistant-adjacent top nav stays above page content", async ({
      page,
    }) => {
      await page.goto("/datasets");
      await openAssistant(page);
      await page.getByTestId("create-dataset-button").click();
      const dialog = page.getByRole("dialog", { name: "Create Dataset" });
      await expect(dialog).toBeVisible();

      // The topmost element at the dialog heading's center belongs to the
      // dialog — nothing (drawer plane, rail, floating controls) paints over
      // an open viewport modal.
      const heading = dialog.getByRole("heading", { name: "Create Dataset" });
      expect(
        await heading.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const top = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
          return element.contains(top) || top === element;
        })
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    });
  });
});
