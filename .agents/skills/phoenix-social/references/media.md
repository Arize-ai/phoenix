# Media

Every asset shows a real thing from Phoenix: real UI, real code, real output. The visual language is
the explainer video's: black or white ground, large Geist type, content set straight on the
background, color only where it carries meaning. No cards, panels, gradients, glows, window
chrome, badges, or uppercase eyebrows.

Keep everything for a post in its working directory so it can be re-rendered:

```
<scratchpad>/social/<YYYY-MM-DD>-<slug>/
  brief.md   posts.md   cards/index.html   media/   out/
```

## Which asset

| Subject | Asset | How |
|---|---|---|
| A UI feature | Screenshot, 2x device scale, cropped to the feature | `phoenix-pr-screenshot` steps 1–3, or `phoenix-explainer-video/references/screenshots.md` for seeding data |
| A UI interaction | 5–15 s screen capture or explainer with a screenshot scene | Explainer video with a `.shot` scene; avoid raw screen recordings with cursors and chrome |
| An SDK, API, or CLI change | Code card | Below |
| A concept or workflow | 10–45 s explainer video | `phoenix-explainer-video`, rendered in one look |
| An integration | Logo card plus a trace screenshot | `phoenix-docs` `cards.py render`; convert its AVIF with `ffmpeg -i card.avif card.png` (X and LinkedIn do not take AVIF) |
| A multi-feature LinkedIn post | Carousel: one card per feature | Code cards rendered as stills, combined into a PDF (below) |

Pick one look per draft. Dark is the default for social; use light when the screenshot is light.

## Code cards and carousels

Cards reuse the explainer template and renderer, so they share its type scale, tokens, and fonts.
`assets/card.css` adds what social cards need on top: the logo header, syntax colors, and a
highlighted line. Each scene is one card; take a still once the scene has fully built.

```bash
VIDEO=.agents/skills/phoenix-explainer-video
mkdir -p <dir>/cards && cp $VIDEO/assets/template.html <dir>/cards/index.html
cp .agents/skills/phoenix-social/assets/card.css assets/brand/arize-phoenix-logo-{light,dark}.svg <dir>/cards/
```

Edit `cards/index.html`:

- Link the layer after the template's `<style>`: `<link rel="stylesheet" href="card.css">`.
- Set the size on `#stage`: `data-width="1920" data-height="1080"` for X and Bluesky,
  `data-width="1080" data-height="1350"` for a LinkedIn portrait card or carousel slide. At
  1080 wide, set `.scene.card` padding to ~80px and the logo to ~56px, and size `.code` the same way.
- One card per scene, with a long `data-dur` (e.g. `4`). Every card has the same structure: the
  logo, then a two-line `.title` (gray lead-in, bright payoff), then one `.code` block or `.shot`:

  ```html
  <section class="scene card" data-dur="4">
    <img class="card-brand only-dark" src="arize-phoenix-logo-dark.svg" alt="Arize Phoenix">
    <img class="card-brand only-light" src="arize-phoenix-logo-light.svg" alt="Arize Phoenix">
    <div class="card-body">
      <h2 class="title">…</h2>
      <pre class="code">…</pre>
    </div>
  </section>
  ```

- Color code when it helps the reader parse it: Python, TypeScript, and JSON nearly always; a
  one-line shell command rarely. Wrap tokens in `.k` (keywords), `.s` (strings), `.f` (the
  function, class, or CLI being called), `.n` (variables and flags), `.c` (comments), and `.p`
  (punctuation, gray). Leave plain identifiers uncolored.
- Size for the timeline, where a card shows ~500px wide. Set the `.code` size per card so its
  longest line fills about 90% of the width: roughly `1600 / (characters × 0.6)` px at 1920 wide,
  capped at 64px. Lower `--title-size` on the section (default 104px) only when a long code block
  needs the height. Preview the stills at 520px wide before staging.
- Highlight the line the post is about with `.hl` on its `.mask` line, at most one or two lines
  per card. It replaces dimming the other lines.
- Keep the runtime `<script>` block unchanged.

Render and check:

```bash
node $VIDEO/scripts/render.mjs <dir>/cards/index.html --info                    # scene start times
node $VIDEO/scripts/render.mjs <dir>/cards/index.html --look dark --stills 3.5,7.5 --stills-dir <dir>/out
```

Take each still near the end of its scene (start + dur − 0.4 s), after every element has arrived
and before the fade-out. Read every still back with the image tool and check it at phone width.

A carousel is a PDF of the slides. Build it with Playwright from the stills (one `<img>` per page,
page size equal to the slide size) or any PDF tool on the machine.

Code on a card is copied by readers: take it from the source or from a run, and keep it to the lines
that matter (≤ 8 lines at 1920 wide, ≤ 10 at 1080 wide).

## Videos

Follow `phoenix-explainer-video` end to end, with these changes for social:

- Render one look (usually dark). Docs-style light/dark pairs are not needed.
- 10–45 s. The first scene must make sense on its own; many viewers see only the first 3 s.
- Skip the release-note "Available in …" scene; the version goes in the post copy.
- The end card is optional on social; end on the finished visual if it is stronger.

## Staging

Upload with `scripts/stage-media.sh` (see SKILL.md). Use short kebab-case file names that say what
the asset is (`prompt-tag-card.png`, `sessions-explainer.mp4`); the folder already carries the date
and slug.
