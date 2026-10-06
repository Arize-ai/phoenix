#!/usr/bin/env tsx
/**
 * Regenerates Overview thumbnails from their `Thumbnail` stories.
 *
 * Every story named `Thumbnail` renders inside the preview's fixed thumbnail
 * frame. This photographs that frame in each docs theme and writes it beside
 * the story file as `<Name>.thumbnail.<light|dark>.webp`, losslessly encoded
 * by `sharp`. The frame fixes the size, so the only input is the story: rerun
 * after a component or its `Thumbnail` story changes, and review the image
 * diff.
 *
 * Reads from a running Storybook rather than starting one: `STORYBOOK_URL`,
 * else `http://localhost:$STORYBOOK_PORT` (from the environment or `.env`),
 * else port 6007.
 *
 * Run: `pnpm storybook:thumbnails [title-prefix…]`, for example
 * `pnpm storybook:thumbnails "Design System/Layout"`.
 *
 * @see app/stories/_meta/thumbnail.ts for the contract
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import sharp from "sharp";

import {
  THUMBNAIL_FRAME_TEST_ID,
  THUMBNAIL_HOVER_ATTRIBUTE,
  THUMBNAIL_SCALE,
  THUMBNAIL_SCALE_ATTRIBUTE,
  THUMBNAIL_SIZE,
  THUMBNAIL_STORY_NAME,
  THUMBNAIL_THEMES,
  thumbnailPixelSize,
  webpInfo,
} from "../stories/_meta/thumbnail";
import type { ThumbnailTheme } from "../stories/_meta/thumbnail";

// tsx runs this as CommonJS (no `import.meta`), and pnpm runs package
// scripts from the package directory, as lint-storybook.ts also assumes.
const APP_DIR = process.cwd();

/**
 * Roomy enough for a frame scaled down to 0.3 (1067×667) plus the preview's
 * surrounding surface.
 */
const VIEWPORT = { width: 1280, height: 800 };

type IndexEntry = {
  id: string;
  title: string;
  name: string;
  type: "story" | "docs";
  importPath: string;
};

function storybookUrl(): string {
  if (process.env.STORYBOOK_URL) {
    return process.env.STORYBOOK_URL.replace(/\/$/, "");
  }
  let port = process.env.STORYBOOK_PORT;
  const envFile = join(APP_DIR, ".env");
  if (!port && existsSync(envFile)) {
    port = readFileSync(envFile, "utf8").match(
      /^\s*(?:export\s+)?STORYBOOK_PORT=["']?(\d+)/m
    )?.[1];
  }
  return `http://localhost:${port ?? 6007}`;
}

/** `…/stories/<rel>.stories.tsx` → `<app>/stories/<rel>`, the image base. */
function outputBase(importPath: string): string | null {
  const rel = importPath.match(/(?:^|\/)stories\/(.+)\.stories\.[jt]sx?$/)?.[1];
  return rel ? join(APP_DIR, "stories", rel) : null;
}

async function openStory(
  browser: Browser,
  url: string,
  theme: ThumbnailTheme,
  deviceScaleFactor: number
) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor,
    colorScheme: theme,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const frame = page.getByTestId(THUMBNAIL_FRAME_TEST_ID);
  await frame.waitFor();
  return { context, page, frame };
}

async function capture(
  browser: Browser,
  baseUrl: string,
  story: IndexEntry,
  theme: ThumbnailTheme,
  path: string
) {
  const url = `${baseUrl}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`;
  let opened = await openStory(browser, url, theme, THUMBNAIL_SCALE);
  try {
    // A scaled frame is laid out 1/scale times larger, so it is shot at a
    // proportionally lower density to keep every image the same size. The
    // scale is only known once the story renders, so reopen at that density.
    const scale = Number(
      (await opened.frame.getAttribute(THUMBNAIL_SCALE_ATTRIBUTE)) ?? 1
    );
    if (scale !== 1) {
      await opened.context.close();
      opened = await openStory(browser, url, theme, THUMBNAIL_SCALE * scale);
    }
    const { page, frame } = opened;
    await page.evaluate(() => document.fonts.ready);
    // Let layout effects and anything the story opens on mount settle.
    await page.waitForTimeout(300);
    // Hover only once layout is final, or the target can move out from
    // under the pointer. The pointer enters from outside in steps, as a real
    // one does: React Aria's tooltips ignored a single jump onto the target.
    const hoverRole = await frame.getAttribute(THUMBNAIL_HOVER_ATTRIBUTE);
    if (hoverRole) {
      const target = await frame
        .getByRole(hoverRole as Parameters<typeof frame.getByRole>[0])
        .first()
        .boundingBox();
      if (!target) {
        throw new Error(`no visible "${hoverRole}" in the frame to hover`);
      }
      await page.mouse.move(target.x - 20, target.y - 20);
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2,
        { steps: 5 }
      );
      await page.waitForTimeout(300);
    }
    const box = await frame.boundingBox();
    const expected = {
      width: THUMBNAIL_SIZE.width / scale,
      height: THUMBNAIL_SIZE.height / scale,
    };
    if (
      !box ||
      Math.abs(box.width - expected.width) > 1 ||
      Math.abs(box.height - expected.height) > 1
    ) {
      throw new Error(
        `the frame measured ${box ? `${box.width}×${box.height}` : "nothing"}, expected ${expected.width}×${expected.height}`
      );
    }
    // Capture the whole viewport, whose image starts at device pixel 0, then
    // crop the frame out of it at exactly the contract's pixel size. A clip
    // cannot do this: Chromium keeps only the device pixels a clip fully
    // encloses, and the frame's box is fractional whenever `1 / scale` is
    // not a whole number (0.55 lays it out 581.8px wide), so a clip of it
    // comes out 639 or 399 pixels.
    const deviceScale = THUMBNAIL_SCALE * scale;
    const viewport = await page.screenshot({
      animations: "disabled",
      caret: "hide",
    });
    const size = thumbnailPixelSize();
    const cropped = await page.evaluate(
      async ({ png, x, y, width, height }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas
          .getContext("2d")!
          .drawImage(image, x, y, width, height, 0, 0, width, height);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      {
        png: viewport.toString("base64"),
        x: Math.round(box.x * deviceScale),
        y: Math.round(box.y * deviceScale),
        ...size,
      }
    );
    // Chromium's own WebP encoder is lossless at quality 1 but writes files
    // larger than the PNG, so the crop leaves the page as PNG.
    writeFileSync(
      path,
      await sharp(Buffer.from(cropped, "base64"))
        .webp({ lossless: true })
        .toBuffer()
    );
    const written = webpInfo(readFileSync(path));
    if (written?.width !== size.width || written?.height !== size.height) {
      throw new Error(
        `wrote ${written ? `${written.width}×${written.height}` : "an unreadable WebP"}, expected ${size.width}×${size.height}`
      );
    }
  } finally {
    await opened.context.close();
  }
}

async function main() {
  const prefixes = process.argv.slice(2);
  const baseUrl = storybookUrl();

  let entries: IndexEntry[];
  try {
    const response = await fetch(`${baseUrl}/index.json`);
    if (!response.ok) throw new Error(`responded ${response.status}`);
    entries = Object.values(
      ((await response.json()) as { entries: Record<string, IndexEntry> })
        .entries
    );
  } catch (reason) {
    process.stderr.write(
      `Could not read ${baseUrl}/index.json (${String(reason)}).\n` +
        "Start this worktree's Storybook, or set STORYBOOK_URL.\n"
    );
    process.exit(1);
  }

  const stories = entries.filter(
    (e) =>
      e.type === "story" &&
      e.name === THUMBNAIL_STORY_NAME &&
      (prefixes.length === 0 || prefixes.some((p) => e.title.startsWith(p)))
  );
  if (stories.length === 0) {
    process.stderr.write(
      `No "${THUMBNAIL_STORY_NAME}" stories match ${prefixes.join(", ") || "anything"}.\n`
    );
    process.exit(1);
  }

  const problems: string[] = [];
  const browser = await chromium.launch();
  try {
    for (const story of stories) {
      const base = outputBase(story.importPath);
      if (!base) {
        problems.push(`${story.title}: cannot place ${story.importPath}`);
        continue;
      }
      for (const theme of THUMBNAIL_THEMES) {
        const path = `${base}.thumbnail.${theme}.webp`;
        try {
          await capture(browser, baseUrl, story, theme, path);
          process.stdout.write(`  ${relative(APP_DIR, path)}\n`);
        } catch (reason) {
          problems.push(
            `${story.title} (${theme}): ${
              reason instanceof Error ? reason.message : String(reason)
            }`
          );
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (problems.length > 0) {
    process.stderr.write(`\n${problems.length} problem(s):\n`);
    for (const p of problems) process.stderr.write(`  ${p}\n`);
    process.exit(1);
  }
}

main().catch((reason: unknown) => {
  process.stderr.write(`${String(reason)}\n`);
  process.exit(1);
});
