import { randomUUID } from "crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Regression coverage for the time range control strip's geometry
 * (https://github.com/Arize-ai/phoenix/issues/15073). Safari resolved the
 * previous stretch + aspect-ratio button sizing differently for the live
 * ToggleButton than for the surrounding pan/zoom Buttons, rendering the
 * play/pause toggle oversized and overflowing the shell. These assertions run
 * across all configured browsers, including the webkit project.
 */

const CONTROL_LABELS = [
  "Pan back in time",
  "Zoom out",
  "Zoom in",
  "Pan forward in time",
] as const;

async function createProject(page: Page, projectName: string) {
  await page.goto("/projects");
  await page.waitForURL("**/projects");
  await page.getByRole("button", { name: "New Project" }).click();
  await expect(
    page.getByRole("heading", { name: "New project" })
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
}

async function getBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** Allow sub-pixel rendering differences between engines. */
function expectClose(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectContained(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
  tolerance = 1
) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - tolerance);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - tolerance);
  expect(inner.x + inner.width).toBeLessThanOrEqual(
    outer.x + outer.width + tolerance
  );
  expect(inner.y + inner.height).toBeLessThanOrEqual(
    outer.y + outer.height + tolerance
  );
}

test.describe("time range controls", () => {
  test.beforeEach(async ({ page }) => {
    await createProject(
      page,
      `time-range-controls-${randomUUID().slice(0, 8)}`
    );
  });

  test("buttons are uniform squares contained by the shell", async ({
    page,
  }) => {
    const controls = page.getByRole("group", { name: "Time range controls" });
    const shellBox = await getBox(controls);

    const liveToggle = controls.getByRole("button", {
      name: /live streaming/,
    });
    const buttons = [
      ...CONTROL_LABELS.map((label) =>
        controls.getByRole("button", { name: label })
      ),
      liveToggle,
    ];

    const boxes = await Promise.all(buttons.map(getBox));
    const reference = boxes[0];
    for (const box of boxes) {
      // Square, and the same square as every sibling.
      expectClose(box.width, box.height);
      expectClose(box.width, reference.width);
      expectClose(box.height, reference.height);
      // Nothing escapes the shell.
      expectContained(box, shellBox);
    }

    // The strip shares its height with the adjacent time range selector.
    const selectorBox = await getBox(
      page.getByRole("group", { name: "Time range", exact: true })
    );
    expectClose(shellBox.height, selectorBox.height);
  });

  test("play and pause states keep the same dimensions", async ({ page }) => {
    const controls = page.getByRole("group", { name: "Time range controls" });
    const shellBox = await getBox(controls);
    const liveToggle = controls.getByRole("button", {
      name: /live streaming/,
    });

    const initialBox = await getBox(liveToggle);
    await liveToggle.click();
    // The accessible name flips with the state, so re-resolving the locator
    // also confirms the toggle actually changed state.
    const toggledBox = await getBox(liveToggle);
    expectClose(toggledBox.width, initialBox.width);
    expectClose(toggledBox.height, initialBox.height);
    expectContained(toggledBox, shellBox);

    // The shell itself must not grow when the toggle state changes.
    const shellAfter = await getBox(controls);
    expectClose(shellAfter.height, shellBox.height);
    expectClose(shellAfter.width, shellBox.width);
  });
});
