import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

// Regression test for #15073: Safari rendered the live ToggleButton larger
// than the sibling pan/zoom Buttons, overflowing the control shell.
test("time range control buttons are uniform squares inside the shell", async ({
  page,
}) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New Project" }).click();
  await page
    .getByRole("textbox", { name: "Name" })
    .fill(`time-range-controls-${randomUUID().slice(0, 8)}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);

  const controls = page.getByRole("group", { name: "Time range controls" });
  const buttons = controls.getByRole("button");
  await expect(buttons).toHaveCount(5);

  const expectUniformSquares = async () => {
    const shell = (await controls.boundingBox())!;
    const boxes = await Promise.all(
      (await buttons.all()).map(async (button) => (await button.boundingBox())!)
    );
    for (const box of boxes) {
      // Square, matching its siblings, and vertically inside the shell
      // (1px tolerance for sub-pixel rendering).
      expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThanOrEqual(1);
      expect(box.y).toBeGreaterThanOrEqual(shell.y - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(
        shell.y + shell.height + 1
      );
    }
  };

  await expectUniformSquares();

  // The play and pause states share the same geometry.
  await controls.getByRole("button", { name: /live streaming/ }).click();
  await expectUniformSquares();
});
