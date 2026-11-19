#!/usr/bin/env node
/**
 * Renders an explainer-video HTML composition (built from assets/template.html)
 * to an MP4, to still PNGs, or to a contact sheet.
 *
 * The page exposes `window.__video` ({ width, height, fps, duration, ready })
 * and `window.__seek(ms)`. Each frame is seeked, screenshotted, and piped to
 * ffmpeg, so output is deterministic and never drops frames.
 *
 * Usage:
 *   node render.mjs <video.html> [--look dark,light] [--out out/video.mp4] [--crf 20] [--from 0] [--to 12]
 *   node render.mjs <video.html> [--look dark,light] --stills 1.5,6,12.25 [--stills-dir out/stills]
 *   node render.mjs <video.html> [--look dark,light] --sheet 12 [--sheet-out out/sheet.png]
 *   node render.mjs <video.html> --info
 *
 * With --look, each output name gets a -<look> suffix (video-dark.mp4, video-light.mp4).
 */
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    look: { type: "string" },
    out: { type: "string" },
    crf: { type: "string", default: "20" },
    from: { type: "string" },
    to: { type: "string" },
    stills: { type: "string" },
    "stills-dir": { type: "string" },
    sheet: { type: "string" },
    "sheet-out": { type: "string" },
    info: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (args.help || positionals.length !== 1) {
  console.log(
    "Usage: node render.mjs <video.html> [--look dark,light] [--out file.mp4] [--crf 20] [--from s] [--to s]\n" +
      "       node render.mjs <video.html> [--look dark,light] --stills 1.5,6,12 [--stills-dir dir]\n" +
      "       node render.mjs <video.html> [--look dark,light] --sheet 12 [--sheet-out file.png]\n" +
      "       node render.mjs <video.html> --info"
  );
  process.exit(args.help ? 0 : 1);
}

const input = resolve(positionals[0]);
const videoDir = dirname(input);
const slug = basename(input, extname(input)) === "index" ? basename(videoDir) : basename(input, extname(input));
const looks = args.look ? args.look.split(",").map((look) => look.trim()) : [null];

/** Adds -<look> before the extension when a look is set. */
const withLook = (file, look) => (look ? file.replace(/(\.[^./]+)$/, `-${look}$1`) : file);

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  for (const look of looks) await renderLook(look);
} finally {
  await browser.close();
}

async function renderLook(look) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });

  await page.goto(`${pathToFileURL(input).href}?render${look ? `&look=${encodeURIComponent(look)}` : ""}`);
  await page
    .waitForFunction(() => window.__video && window.__video.ready === true, null, { timeout: 30_000 })
    .catch(() => {
      throw new Error(
        `The page never set window.__video.ready. Keep the template's <script> block intact.\n${pageErrors.join("\n")}`
      );
    });
  const video = await page.evaluate(() => ({ ...window.__video }));
  for (const warning of video.warnings ?? []) console.warn(`warning: ${warning}`);
  for (const error of pageErrors) console.warn(`page error: ${error}`);
  if (video.width % 2 || video.height % 2) throw new Error("Width and height must be even numbers for H.264.");
  await page.setViewportSize({ width: video.width, height: video.height });

  const capture = async (seconds, type = "png") => {
    await page.evaluate((ms) => window.__seek(ms), seconds * 1000);
    return page.screenshot({ type, ...(type === "jpeg" ? { quality: 95 } : {}) });
  };

  if (args.info) {
    console.log(JSON.stringify(video, null, 2));
  } else if (args.stills) {
    const dir = resolve(args["stills-dir"] ?? join(videoDir, "out", "stills"));
    mkdirSync(dir, { recursive: true });
    for (const seconds of args.stills.split(",").map(Number)) {
      const file = join(dir, withLook(`still-${seconds.toFixed(2)}s.png`, look));
      writeFileSync(file, await capture(seconds));
      console.log(file);
    }
  } else if (args.sheet) {
    const count = Number(args.sheet);
    const times = Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * video.duration);
    const frames = [];
    for (const seconds of times) frames.push({ seconds, data: (await capture(seconds, "jpeg")).toString("base64") });
    const file = withLook(resolve(args["sheet-out"] ?? join(videoDir, "out", "sheet.png")), look);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await renderSheet({ frames, video }));
    console.log(file);
  } else {
    const out = withLook(resolve(args.out ?? join(videoDir, "out", `${slug}.mp4`)), look);
    mkdirSync(dirname(out), { recursive: true });
    const from = Number(args.from ?? 0);
    const to = Math.min(Number(args.to ?? video.duration), video.duration);
    const firstFrame = Math.round(from * video.fps);
    const lastFrame = Math.round(to * video.fps);
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", String(video.fps), "-c:v", "mjpeg", "-i", "-",
        // JPEG frames are full-range; convert to limited-range BT.709 so browsers show true colors.
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-c:v", "libx264", "-preset", "slow", "-crf", args.crf, "-tune", "animation",
        "-movflags", "+faststart", "-an",
        out,
      ],
      { stdio: ["pipe", "inherit", "inherit"] }
    );
    ffmpeg.on("error", () => {
      console.error("ffmpeg is not on PATH. Install it (macOS: brew install ffmpeg).");
      process.exit(1);
    });
    const started = Date.now();
    for (let frame = firstFrame; frame < lastFrame; frame++) {
      const jpeg = await capture(frame / video.fps, "jpeg");
      if (!ffmpeg.stdin.write(jpeg)) await once(ffmpeg.stdin, "drain");
      if ((frame - firstFrame) % (video.fps * 5) === 0) {
        process.stderr.write(`\rframe ${frame - firstFrame}/${lastFrame - firstFrame}`);
      }
    }
    ffmpeg.stdin.end();
    const [code] = await once(ffmpeg, "close");
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    const megabytes = (statSync(out).size / 1024 / 1024).toFixed(1);
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    process.stderr.write("\n");
    console.log(`${out} (${(to - from).toFixed(1)}s, ${video.width}x${video.height}@${video.fps}, ${megabytes} MB, rendered in ${seconds}s)`);
  }
  await page.close();
}

/** Composes frames into one grid image, with each frame's time below it, for a quick visual review. */
async function renderSheet({ frames, video }) {
  const columns = 4;
  const cellWidth = 480;
  const cellHeight = Math.round((cellWidth * video.height) / video.width);
  const page = await browser.newPage({ viewport: { width: columns * cellWidth + (columns + 1) * 8, height: 100 } });
  const cells = frames
    .map(
      ({ seconds, data }) =>
        `<figure><img src="data:image/jpeg;base64,${data}"><figcaption>${seconds.toFixed(2)}s</figcaption></figure>`
    )
    .join("");
  await page.setContent(`<style>
    body { margin: 0; padding: 8px; background: #2a2a2a; display: grid; gap: 8px;
      grid-template-columns: repeat(${columns}, ${cellWidth}px); }
    figure { margin: 0; }
    img { width: ${cellWidth}px; height: ${cellHeight}px; display: block; }
    figcaption { padding: 4px 2px 0; color: #ccc; font: 500 13px/1.2 monospace; }
  </style>${cells}`);
  const buffer = await page.screenshot({ type: "png", fullPage: true });
  await page.close();
  return buffer;
}

/** Resolves playwright from the working directory, then from the Phoenix repo's js/app package. */
function loadPlaywright() {
  const bases = [process.cwd()];
  try {
    const root = execFileSync("git", ["-C", dirname(fileURLToPath(import.meta.url)), "rev-parse", "--show-toplevel"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    bases.push(join(root, "js", "app"));
  } catch {
    // The script is not inside a git checkout.
  }
  for (const base of bases) {
    try {
      return createRequire(join(base, "noop.js"))("playwright");
    } catch {
      // Try the next base directory.
    }
  }
  console.error(
    "Cannot find the playwright package. Run `pnpm install` in js/app of the Phoenix repo, or `npm i playwright` in the working directory."
  );
  process.exit(1);
}
