# Real-UI screenshots

Use screenshots when the video shows where something is in Phoenix. Use type and simple diagrams when it explains a concept.

## Capture

1. Start Phoenix with a fresh working directory. Follow steps 1 and 2 of the `phoenix-pr-screenshot` skill to build the frontend and run the server.
2. Load data that matches the story. For example, run a small traced script, or create the dataset or experiment that the video talks about. Do not show real customer data, API keys, or personal emails.
3. Capture each screen twice, once in the Phoenix dark theme for the black look and once in the light theme for the white look. Use the same aspect ratio as the frame where the screenshot appears, and `deviceScaleFactor: 2`, so zooms up to 2× stay sharp.
4. Record the bounding boxes of the elements you plan to point at. Then you can place spotlights from measured values instead of guesses.

```js
// capture.mjs: run it from js/app so that playwright resolves
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const [url, name] = process.argv.slice(2); // name: assets/trace-details
const viewport = { width: 1600, height: 900 };
const browser = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await context.addInitScript((t) => localStorage.setItem("arize-phoenix-theme", t), theme);
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${name}-${theme}.png` });
  if (theme === "dark") {
    // Boxes as % of the screenshot, ready for style="left/top/width/height"
    const box = async (locator) => {
      const b = await locator.boundingBox();
      const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;
      return { left: pct(b.x, viewport.width), top: pct(b.y, viewport.height), width: pct(b.width, viewport.width), height: pct(b.height, viewport.height) };
    };
    const boxes = { addEvaluator: await box(page.getByRole("button", { name: "Add Evaluator" })) };
    writeFileSync(`${name}.boxes.json`, JSON.stringify(boxes, null, 2));
  }
  await context.close();
}
await browser.close();
```

## Present

- Put both screenshots in a `.shot` inside a `.shot-layer`, one with `.only-dark` and one with `.only-light`. The template's commented-out `ui` scene shows the markup.
- Put spotlights and click marks inside the `.shot-layer`, so they move with the camera. Their coordinates are percentages of the screenshot.
- Zoom to the region that the headline names. A full Phoenix page at docs size is not readable, and zooms of 1.5–2.5× usually work.
- Point with `.spot`: it dims everything outside the target. Do not add rings, arrows, or boxes.
- One screenshot can carry several beats: zoom to the first target, then pan to the next. Use a new screenshot only when the UI state changes, such as after a click that opens a dialog.
