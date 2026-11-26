---
name: phoenix-explainer-video
description: Make short, silent explainer videos (MP4) that teach one Phoenix feature or concept, for docs pages and release notes. Ground the story in the actual code, storyboard it as a sequence of two-line headlines, build the scenes as one type-led HTML file, check frames as stills, and render matching black and white versions with the bundled Playwright + ffmpeg renderer. Use whenever someone wants an explainer video, animated walkthrough, feature clip, demo video, motion graphic, or looping animation for a Phoenix feature or concept, or asks to "make a video" for a docs page, changelog, or release note, even if they don't say "explainer".
metadata:
  internal: true
---

# Phoenix Explainer Video

This skill makes a 15–60 second, 16:9, silent MP4 that teaches one idea. Docs pages autoplay videos muted and looped, so the words on screen do all the teaching. The source is one HTML file that renders in two looks, black and white, so each reader sees the version that matches their docs theme. The source can be edited and re-rendered when the product changes.

**Requirements:** `ffmpeg` on PATH (macOS: `brew install ffmpeg`), the `playwright` package (resolved from `js/app` in this repo), and network access to Google Fonts for Geist.

## Workflow

### 1. Get the facts from the code

Read the feature before you write a word: the PR or commits, the code, the docs page that will host the video, and the release note if one exists. Write down the exact strings that will appear on screen: UI labels, function and parameter names, CLI flags and output, field names, and version numbers.

Every claim, label, and line of code in the video must match the shipped code. A video is harder to correct than a docs page, and viewers copy code from frames. Check UI labels with `git grep` in `js/app/src`, and check signatures in `packages/` or `js/packages/`. Run code and CLI commands when you can, and copy real output instead of writing it.

### 2. Write the storyboard

A viewer comes to the page with a question, such as "what is a span?" or "how do I turn this on?". The video answers that question, one part per scene.

- **Show, then name.** Put a concrete example on screen first: a real span name, a real duration, or a real line of code. Then name the concept. A viewer remembers `write_reply 1.19 s` better than "LLM spans record latency".
- **One new idea per scene.** If a headline needs "and", split the scene.
- **Build on the last frame.** When the next idea extends the previous one, keep the visual and add to it: a span gets children, or a call gets an argument. A cut to a new picture makes the viewer start again.
- **End on what the viewer can now do or see,** not on a slogan.

**Teach, don't announce.** The video is a short lesson, not a promo. The viewer should finish it knowing why something happens, not only that it happens.

- **Order scenes like a lesson.** Start from what the viewer already knows, state the rule, and then show the cases that follow from it. Each scene uses only what earlier scenes taught.
- **Keep one visual language.** Give a visual its meaning once (for example, solid means cached), then reuse it so that later scenes need no new explanation.
- **Pair a problem with its fix.** When a scene shows what goes wrong, add one line that says what to do instead.

Each scene has one headline in two lines. The first line, in gray, gives context that the viewer already has. The second line, in bright text, states the new idea. Together they read as one sentence:

| Gray | Bright |
|------|--------|
| Each step of a request | becomes a span. |
| Turn on tracing | with one call. |

Write `storyboard.md` in the video directory before you build, because changing a sentence costs less than changing an animation:

```markdown
# <Video title>
Placement: docs page docs/phoenix/<path>.mdx | release note <date>
Length: ~25s · Loops: yes

| # | id | dur | Lead-in (gray) | Payoff (bright) | Visual | Motion |
|---|----|-----|----------------|-----------------|--------|--------|
| 1 | spans | 6s | Each step of a request | becomes a span. | Four spans with timing bars | Rows rise in order, bars grow |
| 2 | kinds | 5s | Every span has | a kind. | Same rows; kind labels appear | Labels fade in, one at a time |
```

Show the storyboard to the user before you build, unless they asked for a finished video in one pass.

**Words.** Headlines follow the docs writing rules (Simplified Technical English; see the `phoenix-docs` skill):

- At most 12 words in a headline, with the payoff as short as possible. Use the present tense and active voice.
- Use the exact UI and API names.
- Write like a colleague who explains at a whiteboard: plain, calm, and specific.
- Use no marketing words ("powerful", "seamless"), rhetorical questions, or exclamation marks. Show the benefit instead.
- Never name other observability or eval products.

**Timing.** A viewer reads the headline first, then looks at the visual. Give each scene at least 1.5s plus 0.3s per headline word, add time for the visual to finish, and then hold the finished frame for at least 1.5s. A docs video is 15–45s long, and a release-note video is 20–60s. A concept lesson that works through several cases can run to about 75s. If it runs longer, cut a case instead of cutting reading time.

### 3. Build the HTML

Create a directory for the video. Use the location the user names, or else a temp or scratchpad directory, and tell the user the path. Keep the HTML, storyboard, assets, and output together so the video can be re-rendered later.

```bash
SKILL=.agents/skills/phoenix-explainer-video
mkdir -p <video-dir>/assets
cp $SKILL/assets/template.html <video-dir>/index.html
cp $SKILL/assets/phoenix-logo.svg <video-dir>/
```

The template is a working 18-second example: a statement, a span timeline, code with one line in focus, a commented-out screenshot scene, and the Arize Phoenix end card. Replace its scenes with your storyboard. Each row becomes a `<section class="scene" id="…" data-dur="…">`, and scenes play in order. Inside a scene, give each element a timed class (`in-up` inside a `.mask`, `in-fade`, `in-grow`, `dim`, `move`) and a `--at` offset in seconds. Read `references/animation.md` before you write motion that the template does not show.

**Design.** The look is spare and type-led. Typography and one clean visual carry each scene.

- Set content straight on the background. Do not use cards, panels, borders, shadows, gradients, glows, window chrome, badges, pills, or uppercase eyebrow labels. They make the video look generic and hide the content.
- Use the template's type scale: `.display` (148px) for statement scenes, `.title` (80px) for headlines, `.body` (44px), and `.label` (32px). Nothing is smaller than 32px, because a docs page shows the frame at about 40% scale.
- Make emphasis with brightness and size: gray for context, bright for what matters. Never color a word to emphasize it.
- Use color only when it carries meaning, such as span kinds (the `--k-*` tokens match Phoenix) or success and error states that the story is about.
- To point at something, dim everything else: use `.dim` for code and rows, and `.spot` for screenshots. Do not draw boxes, rings, or highlight bars.
- Keep one focal point per scene. Reveal elements in reading order, 0.1–0.4s apart.
- If a scene feels empty, make the type or the visual bigger. Do not add elements.
- Show the real UI only with screenshots (see `references/screenshots.md`). A drawn copy of a Phoenix screen drifts from the product. Diagrams may use Phoenix's vocabulary, such as span kinds, their colors, and real field names.
- Style everything through the tokens (`--text`, `--text-2`, `--rule`, `--k-*`) and never with literal colors, so both looks work.
- A docs video loops, so it ends on the end card or another calm frame. A release-note video can show "Available in arize-phoenix X.Y.Z+" as `.body` text before the end card.

Open `index.html` in a browser to preview it. Space plays and pauses, the arrow keys step by 1s (or by one frame with Shift), the look button switches between black and white, and `?t=12.5` opens the video paused at 12.5s.

### 4. Check frames before you render

```bash
node $SKILL/scripts/render.mjs <video-dir>/index.html --info                           # scene timings and warnings
node $SKILL/scripts/render.mjs <video-dir>/index.html --look dark,light --sheet 12     # out/sheet-dark.png, out/sheet-light.png
node $SKILL/scripts/render.mjs <video-dir>/index.html --look dark,light --stills 4.2,9.8
```

Look at the sheets and stills with your image-reading tool. Take a still at the moment each scene is fully built, just before it fades out. Check:

- No text overflows, wraps badly, or overlaps another element, in either look.
- Every headline is on screen long enough to read (`--info` shows the durations).
- Each visual appears after the headline that explains it, and the eye has one place to go.
- Nothing on screen is there only for decoration.
- Code, labels, and values match what you collected in step 1.
- `--info` reports no warnings. A font warning means Geist did not load.

Fix problems and check again. A check takes seconds, and a full render takes about one second per second of video.

### 5. Render

```bash
node $SKILL/scripts/render.mjs <video-dir>/index.html --look dark,light                 # out/<dir-name>-dark.mp4, out/<dir-name>-light.mp4
node $SKILL/scripts/render.mjs <video-dir>/index.html --look dark --from 8 --to 14      # part of one look, for a quick check
```

The output is 1920×1080, 30 fps, H.264, BT.709, with no audio track and faststart enabled. A 30-second video is usually under 1 MB per look. Screenshot-heavy videos are larger. If a file is over about 10 MB, raise `--crf` (default 20; 23–26 is still clean).

Name the video directory in kebab-case for the feature and what it shows, for example `session-turns-overview`.

### 6. Deliver

Do not commit MP4 files to the repo. Explainer videos live in one folder of the public `arize-phoenix-assets` bucket:

| | |
|---|---|
| Bucket path | `gs://arize-phoenix-assets/assets/videos/explainers/` |
| Public URL | `https://storage.googleapis.com/arize-phoenix-assets/assets/videos/explainers/<name>-{dark,light}.mp4` |
| File names | `<name>-dark.mp4` and `<name>-light.mp4`, where `<name>` is the video directory name. Use no subfolders. |

Other files in `assets/videos/` are screen recordings that docs pages link to. Do not move or rename them.

Before you upload, check that the name is not taken, because a copy to an existing name replaces that video on every page that uses it:

```bash
gcloud storage ls gs://arize-phoenix-assets/assets/videos/explainers/<name>-*
gcloud storage cp <video-dir>/out/<name>-dark.mp4 <video-dir>/out/<name>-light.mp4 \
  gs://arize-phoenix-assets/assets/videos/explainers/ --content-type=video/mp4
```

Uploading makes the files public, so ask the user before you upload. If they want to upload the files themselves, give them the command. To update a published video, re-render it under the same name and upload it again.

Embed both looks. The docs show the one that matches the reader's theme (the same classes switch light and dark images in `docs/phoenix/integrations/evaluation-integrations/harbor.mdx`):

```mdx
<video autoPlay muted loop playsInline className="w-full aspect-video rounded-xl block dark:hidden"
  src="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/explainers/<name>-light.mp4"></video>
<video autoPlay muted loop playsInline className="w-full aspect-video rounded-xl hidden dark:block"
  src="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/explainers/<name>-dark.mp4"></video>
```

For a release note where readers start playback themselves, replace `autoPlay muted loop` with `controls`.

When you finish, report the MP4 paths, the public URLs if you uploaded the files, their length and size, the contact sheet paths, and the source directory, and list any facts you could not check against the code.
