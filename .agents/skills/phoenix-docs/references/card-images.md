# Card images

Art for `<Card img>` and page banners comes from one generator, `scripts/cards.py`. Do not make or upload these images by hand. This page covers where they live, how to add one and how to keep the docs in sync. [card-design.md](card-design.md) covers how they look.

## Where cards live

Every card and banner is one table in `assets/cards/cards.toml` and one file in GCS. The two mirror each other:

| Manifest table | GCS path under `docs-cards/` | Shows |
| --- | --- | --- |
| `[integrations.<logo>]` | `integrations/<logo>.avif` | A brand mark |
| `[integrations.<logo>-<badge>]` | `integrations/<logo>-<badge>.avif` | A brand mark and one qualifier |
| `[topics.<motif>]` | `topics/<motif>.avif` | One drawing of a Phoenix product area |
| `[banners.<page>]` | `banners/<page>.avif` | The banner that opens one page |

The full URL prefix is `https://storage.googleapis.com/arize-phoenix-assets/assets/images/docs-cards/`. `<logo>` and `<badge>` are file stems in `assets/cards/logos/`. `<page>` is the page's path under `docs/phoenix/` in kebab-case: `settings/sandboxes.mdx` is `banners/settings-sandboxes.avif`. The path follows from the art or the page, so anyone can predict a URL: the OpenAI evals card is `integrations/openai-evals.avif`. `cards.py` rejects a table whose key does not match its art, and tables stay in alphabetical order.

Paths never change. When a card's art changes, its file is replaced in place and pages pick up the new art within an hour (`Cache-Control: public, max-age=3600`).

## Rules for grids

- Use one visual treatment per grid: image cards or compact icon cards. Do not mix the two.
- Add images when they distinguish products, sources, or concepts. Keep task and reference links compact when the same illustration would repeat across the grid.
- On the integrations index, cards show the plain brand mark and every grid is alphabetical by title. `relink` keeps qualifier cards off the index, and `status --check` flags any it finds. If the brand has no plain card yet, add `[integrations.<logo>]` first.
- Follow [card-design.md](card-design.md) for how each card looks.

## Reuse before you create

Most docs changes need no new art.

1. Work out the path from the convention above.
2. Run `cards.py url <path>`. If it prints a URL, put it in the `<Card img>`. You are done.
3. Only if no card fits, add one (next section).

Do not re-render or re-push cards to refresh them. Do not edit `scripts/card_design.py` while you add a card.

## Add a card

1. If the logo is new, vendor it: `cards.py logo <name> <source>`. Sources are `lobehub:<icon>`, `simple:<icon>`, `devicon:<path>`, `platform:<Icon>` (an icon from the Phoenix app), a URL or a local file. Take the mark from the brand's own site or repository when the icon sets are out of date, and compare it with the site before you use it.
2. Add the table to `cards.toml`, in alphabetical order.
3. Run `cards.py render <path> --sheet`. Check the card at 158 px and 334 px in both docs themes.
4. Run `cards.py push <path>`. A new path is safe to upload from a branch: no live page uses it yet.
5. Put `cards.py url <path>` in the `<Card img>`, and commit the manifest, the logo and the MDX together.

## Add a banner

A banner is the image that opens a page, right after the frontmatter. Give one to an overview page that opens with a decorative image, such as a brand logo or a section intro. Never replace a screenshot or a diagram: those are content.

1. Add `[banners.<page>]` to `cards.toml` with a `title` and exactly one kind of art: `motif`, `logo` or `marks` (two to six logo stems). The title is the page name as the brand writes it. List the page's old opening image in `replaces`.
2. Run `cards.py render banners/<page> --sheet`. Check the banner at 689 px and 350 px in both docs themes.
3. Run `cards.py push banners/<page>`.
4. Run `cards.py relink`. It swaps the opening image for `![<title>](<url>)` and drops the old sizing and `<Frame>`. A page with no opening image gets that line by hand.

## Change a published card

Replacing a published file changes every live page that uses it, before your PR merges. So:

1. Edit the table or the logo in a PR and review the sheet.
2. After the PR merges, run `cards.py push --replace <path>`.

`push` without `--replace` never overwrites a published card. It lists the changed cards and stops.

## Change the design

Edit `scripts/card_design.py` and `references/card-design.md` together, in a PR of their own. Render every card with `cards.py render --sheet` and review them all. After the PR merges, run `cards.py push --replace`. The MDX does not change.

## Replace legacy images

`relink` swaps a legacy `<Card img>` URL for a card when the URL is listed in that card's `replaces`. For a banner, it swaps only a page's opening image, never the same file further down a page. A plain URL swaps every `<Card>` that uses it. `{ url = "…", title = "…" }` or `{ url = "…", href = "…" }` swaps only the `<Card>`s whose attributes match the regexes. At most one entry may match a `<Card>`; manifest order does not matter.

## Check for drift

Run `cards.py status --check` before you merge. It fails if the MDX uses a card or banner that is missing or changed in GCS, uses an unknown one, has duplicate `img` attributes, or matches two `replaces` entries. It also lists legacy images that are not managed yet, and GCS objects under `docs-cards/` that belong to no card.
