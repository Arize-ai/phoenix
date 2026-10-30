# Card design language

Card art is a quiet signpost. The card title carries the words. The art tells the reader, at a glance, which product or which part of Phoenix the card is about. Exact values live in `scripts/card_design.py`; this page explains what they are for.

## Principles

1. **One idea per card.** A logo, a logo with one qualifier, or one gesture from the product. Nothing else.
2. **Flat.** No gradients, glows, shadows, textures, patterns or decorative lines.
3. **Black and white first.** Shapes use the docs' neutral grays. Color appears once, and only in a topic drawing.
4. **No text.** Words in art are unreadable at card size and duplicate the title.
5. **Designed for the smallest card.** A 1200 px canvas shows at 158 CSS px in a 4-column grid, about one eighth of its size. Draw so the art still reads there.
6. **The name is the picture.** Cards with the same art share one name and one file (see [card-images.md](card-images.md)).

## Canvas and palette

The canvas is 1200 × 675 (16:9). The ground is flat gray-900, the same color as the docs' dark card body. In dark mode the art merges into the card, so a logo seems to sit on the card itself. In light mode the art reads as a dark panel on a light card. Both are intended; one image serves both themes.

Content centers on an optical center slightly above the middle of the canvas.

| Role | Color | Use |
| --- | --- | --- |
| Ground | `#151616` gray-900 | The whole canvas |
| Ink | `#F7F7F8` gray-50 | Logos, qualifiers, the lockup divider, primary shapes |
| Secondary | `#A1A4AB` gray-400 | Supporting shapes, tool outlines, text bars |
| Guide | `#565A62` gray-600 | Edges, rules, tracks, container outlines |
| Raised | `#2B2D31` gray-800 | Header bands |
| Focal | `#39C7FF` cyan | The one shape the reader should look at, in topic drawings only |

All colors come from the docs' neutral ramp and accent in `docs/style.css`. Do not add brand colors.

## Logo cards

A logo card shows one brand mark in ink, centered.

- **The mark.** Use the brand's single-color symbol. Use the wordmark only when the brand has no symbol. The renderer paints the mark's shape in ink, so a mark with a background or multicolor fills must be cleaned to one silhouette first.
- **Size by visual weight.** Marks are sized by their area, not by their width or height, so a square symbol and a wide mark look equally heavy. A cap keeps any mark inside a box about half the canvas wide and two fifths tall. Thin or outlined marks get a small boost so they do not look lighter than solid ones.

### The lockup

When sibling cards share a brand, each adds one qualifier after a divider: brand, divider, qualifier.

- The brand and the qualifier have the **same height** and the **same ink**.
- The divider is a thin light rule of the same height.
- The space on each side of the divider is equal.
- The three parts center as one group.

A qualifier is either a **language** (Python, TypeScript, JavaScript, Node.js, Go, Java, .NET) or a **Phoenix capability** (evals). Capability glyphs come from the app's own icon set, `js/app/src/components/core/icon/Icons.tsx`, so docs and product use the same symbol for the same idea. Use at most one qualifier.

Overview pages that list many brands (the integrations index) show only the plain brand mark; a qualifier there reads as noise. On a brand's own pages, add a qualifier only when it separates sibling cards. A brand's own sub-products keep the plain brand mark. When one qualifier cannot separate every variant, pick the one that names the product area and let the card titles carry the rest.

Never replace a brand mark with a generic or capability icon. A card about an AWS, Google or Microsoft product always shows that brand's own mark.

For a language, use the mark readers associate with it, not the newest one: Java is the coffee cup, not Duke.

## Topic cards

A topic card draws one gesture from the Phoenix surface it teaches. It uses a small vocabulary of shapes, each with one meaning:

| Shape | Means |
| --- | --- |
| Rounded bar | A line of text or a value |
| Circle | An agent or LLM step |
| Rounded square, outlined | A tool call |
| Large rounded box, outlined | A container: a subagent, a table, a search box |
| Ring | A score |
| Column | A measured result |
| Chevron | A command prompt or a processing step |
| Play triangle | A video |

One shape in each drawing is cyan. It marks what the reader should look at: the selected span, the passing score, the answer.

| Motif | Drawing | Cyan shape |
| --- | --- | --- |
| `trace` | A span waterfall: four bars on one timeline, each starting inside its parent | The selected span |
| `eval` | A score ring around a check mark | The score arc |
| `prompt` | Three lines of text; the middle line holds a template variable | The variable |
| `dataset` | A ruled table: a header band, three rows, three columns | One value in the selected row |
| `experiment` | Three pairs of columns, baseline in gray beside candidate in white | The best candidate |
| `agent` | A trajectory read left to right: agent step, tool call, a subagent box holding its own step and tool, then the answer | The answer |
| `retrieval` | A magnifier beside three ranked result bars | The top result |
| `cli` | A terminal window: two commands and a waiting prompt | The cursor |
| `judge` | Answer lines pass through a judge model into a score ring | The score arc |
| `pipeline` | Spans pass through one processing step and come out | One processed span |
| `sandbox` | Code brackets inside an isolated boundary | The slash in `</>` |
| `annotation` | Three trace lines, each with a label chip | The chip marking a failure |
| `video` | A player frame with a play button and a progress bar | The progress |

### Drawing a new motif

- Use the shape vocabulary above. Give a new shape a meaning before you use it.
- Use eight shapes or fewer. Remove anything the reader does not need to recognize the gesture.
- Make exactly one shape cyan.
- Keep the drawing inside the middle of the canvas, around the optical center, with the same margins as the other motifs.
- Keep meaningful lines at 6 px or more, rules at 4 px or more, and shapes at 28 px or more.
- Render the review sheet and compare the new motif beside the others at 158 px and 334 px.

## Page banners

A banner opens a docs page and says one thing: the page name, set large and heavy beside one piece of art. Exact values live in `scripts/banner_design.py`.

- **Canvas.** 1536 × 512 (3:1) on the same flat ground as the cards. It shows at 689 CSS px on desktop and 350 px on a phone.
- **Grid.** Twelve 90 px columns with 24 px gutters, 96 px side margins and 88 px top and bottom margins. The title takes columns 1–6, column 7 stays empty, and the art takes columns 8–12.
- **Title.** Geist Bold in ink, one size on every banner, with its cap height centred on the canvas. A long name wraps to two balanced lines. `cards.py` rejects a title that needs three. Banners are the one place art carries text. They have no label above the title and no description below it.
- **Art.** Exactly one of:
  - a topic drawing, scaled into the art columns;
  - one brand mark, sized by visual weight like a logo card;
  - two to six brand marks in equal cells: one row of up to four, or two rows for five or six.
- **Banner-only drawings.** A drawing that only banners need lives in `banner_design.py`, drawn with the card vocabulary in card coordinates, so it can move to `card_design.py` later. Moving it changes every card's fingerprint. `settings` shows three labelled switches; the one switched on is cyan. A switch means a setting.

## Do not

- Use screenshots. Product UI is unreadable at card size.
- Use brand colors, a second accent, or cyan on a logo card.
- Put badges, tiles or stickers in a corner.
- Add decoration: dot grids, rails, frames, glows or noise.
- Put text in the art. A banner's title is the only exception.
- Add a subtitle, label or second line of copy to a banner.
