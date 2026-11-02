# Animation reference

## Timeline model

- Scenes are `<section class="scene" data-dur="…">` children of `#stage`, and they play in order. The runtime sets `--start` and `--dur` on each scene. A scene is visible only from `--start` to `--start + --dur`, and it fades in and out over 0.3s.
- Every motion is a CSS animation that exists when the page loads. After load, the runtime pauses all of them. Then `window.__seek(ms)` sets each one to the frame time. The renderer and the preview both call `__seek`, so the preview matches the MP4 frame for frame.
- Timed classes start at `calc(var(--start) + var(--at))`. `--start` comes from the scene, and you set `--at` on the element.
- The look comes from `data-look` on `#stage` (`dark` or `light`). The renderer's `--look` flag and the preview's look button set it. Both looks share one timeline.

These rules follow from the model. If you break one, a frame renders differently from the preview, or does not change at all:

- Time comes only from `__seek`. Do not use `setTimeout`, `setInterval`, `Date.now()`, `requestAnimationFrame` loops, CSS transitions, or JS that toggles classes. For effects that CSS cannot express, use `Video.onFrame(t => …)`, which must be a pure function of `t`.
- Never use `display: none` on an element that animates, or on one of its ancestors. Its animations do not exist at load. Hide elements with `opacity` or `visibility`. (`.only-dark` and `.only-light` use `display: none`, so keep animations on a wrapper around them.)
- Do not use `<video>`, animated GIFs, or SMIL SVG animations, because they do not follow `__seek`. Use still screenshots and move them with `.move`.
- Do not use random values, unless they come from a fixed seed.
- Reference assets with relative paths (`assets/foo.png`). The page loads from `file://`.

## Classes

| Class | Effect | Variables |
|-------|--------|-----------|
| `in-up` | Rises into place. Put it inside a `.mask` so the line appears from behind an edge. | `--at`, `--len` (0.9s) |
| `in-fade` | Opacity 0 → 1 | `--at`, `--len` |
| `in-grow` | Scales X from 0, from the left. Use it for bars and rules. | `--at`, `--len` |
| `dim` | Fades to `--dim-to` (0.28), to move focus to what stays bright | `--at`, `--len` (0.6s), `--dim-to` |
| `in-click` | A thin ring that marks a click. Put it on a `.click` element. | `--at`, `--len` (0.7s) |
| `out-fade` | Fades out at `--out`. Put it on a wrapper element. | `--out` |
| `move` | Transform from `--from` to `--to` | `--at`, `--len` (1.2s), `--from`, `--to` |

Type: `.display`, `.title`, `.body`, `.label`, `.muted` (gray), `.mono`. Layout: `.row`, `.col`, `.fill` (takes the remaining height), `.scene.center`. Visuals: `.timeline` (`.t-row`, `.t-name`, `.t-kind`, `.t-track`, `.t-bar`, `.t-dur`), `.code` (`.p` for gray punctuation and keywords), `.shot` and `.shot-layer`, `.spot`, `.click`, `.lockup`. Per look: `.only-dark`, `.only-light`.

An element has one `animation` property, so it can use only one timed class. To combine effects, nest elements. For example, put `in-up` on a line and `dim` on a span inside it, or put an `out-fade` wrapper around an `in-up` child.

## Recipes

**Headline lines.** Wrap each line in its own mask, with the second line 0.1–0.15s after the first:

```html
<h2 class="title">
  <span class="mask"><span class="in-up muted" style="--at: .1s">Every span has</span></span>
  <span class="mask"><span class="in-up" style="--at: .22s">a kind.</span></span>
</h2>
```

**Build on the last frame.** To add an idea without a cut, keep the visual in one scene and change the headline in place. Stack the headlines in one grid cell, and wrap each one that leaves in `.out-fade`:

```html
<div style="display: grid">
  <div class="out-fade" style="grid-area: 1/1; --out: 4s">
    <h2 class="title"><span class="mask"><span class="in-up muted" style="--at: .1s">Each step of a request</span></span>
      <span class="mask"><span class="in-up" style="--at: .22s">becomes a span.</span></span></h2>
  </div>
  <h2 class="title" style="grid-area: 1/1"><span class="mask"><span class="in-up muted" style="--at: 4.3s">Every span has</span></span>
    <span class="mask"><span class="in-up" style="--at: 4.42s">a kind.</span></span></h2>
</div>
```

The new elements in the visual then use `--at` values after 4.3s.

**Focus by dimming.** Put `dim` on everything except the subject, all with the same `--at`. The subject stays bright, and the eye goes to it without a box or an arrow.

**Swap a value in place** (for example, a score that changes from 0.41 to 0.87). Stack both values in one grid cell. Wrap the old value in `out-fade`, and give the new one `in-up` inside a `.mask`, with `--at` just after the old value's `--out`.

**A simple flow.** Set words in a row, with thin rules between them that grow from the left:

```html
<div class="row" style="gap: 40px">
  <span class="mask"><span class="in-up body" style="--at: .8s">Your app</span></span>
  <div class="in-grow" style="--at: 1.1s; --len: .5s; width: 160px; height: 2px; background: var(--text-2)"></div>
  <span class="mask"><span class="in-up body" style="--at: 1.5s">OpenTelemetry</span></span>
  <div class="in-grow" style="--at: 1.8s; --len: .5s; width: 160px; height: 2px; background: var(--text-2)"></div>
  <span class="mask"><span class="in-up body" style="--at: 2.2s">Phoenix</span></span>
</div>
```

**Camera with several stops.** For more than one move, write keyframes for the scene. Always include `var(--start)` in the delay:

```css
#ui .shot-layer { animation: cam-ui 6s var(--ease-in-out) var(--start) both; }
@keyframes cam-ui {
  0%, 15%   { transform: none; }
  40%, 70%  { transform: translate(-40%, -20%) scale(2); }
  90%, 100% { transform: none; }
}
```

Percentages are fractions of the animation length (6s here). `.shot-layer` uses `transform-origin: 0 0`. To put the image point at (x%, y%) in the top-left corner at scale `s`, use `translate(-(x·s)%, -(y·s)%) scale(s)`. For example, `translate(-40%, -20%) scale(2)` puts the point at (20%, 10%) in the corner. Check the result with `--stills`.

**Drawn lines between points.** Use an SVG in the scene with a 2px stroke in `var(--text-2)`. Animate it with `in-fade`, or draw it with a stroke-dashoffset animation. Give the path `pathLength="1"` and write a keyframe for the scene, using `var(--start)` in the delay.

**Typed text and counters** use `Video.onFrame`. The function gets absolute seconds, so subtract the scene start:

```html
<code id="cmd" class="mono body"></code>
<script>
  const cmd = "px trace list --limit 3";
  const scene = Video.scenes.find((s) => s.id === "cli");
  Video.onFrame((t) => {
    const local = t - scene.start - 1; // starts typing 1s into the scene
    document.getElementById("cmd").textContent = cmd.slice(0, Math.max(0, Math.floor(local * 18))); // 18 chars/s
  });
</script>
```

Put this script after the runtime `<script>` block.

**Persistent elements.** An element placed directly in `#stage`, outside every scene, stays visible for the whole video. `--start` is 0 there, so `--at` is absolute time.

**Overlapping scenes** are not supported. Scenes are sequential, and each fades out and in over 0.3s. To keep a visual on screen while the story moves on, keep it in one scene (see "Build on the last frame").
