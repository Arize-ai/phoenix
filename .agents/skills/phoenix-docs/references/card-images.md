# Card images

Art for `<Card img>` comes from one generator, `scripts/cards.py`. Do not make or upload card images by hand.

## Rules

- Every `<Card img>` points at a managed card: `https://storage.googleapis.com/arize-phoenix-assets/assets/images/docs-cards/<id>.<fingerprint>.avif`.
- Cards are 1200×675 (16:9) AVIF, about 12 KB. Mintlify shows card images at their natural aspect ratio, so one ratio keeps grid rows even.
- Logos are monochrome. The generator recolors the mark; vendor the brand's single-color symbol, not a full-color or wordmark file.
- Do not show the same art twice on one page. Sibling cards that share a logo differ by badge: a language (`python`, `typescript`, `javascript`, `nodejs`, `go`, `java`, `dotnet`) or a capability (`evals`, `agents`, `workflows`).
- Card art has no text. The card title carries the words.
- Cards without a brand (tutorials, cookbooks) use the `topic` template with a motif: `trace`, `eval`, `prompt`, `dataset`, `experiment`, `agent` or `retrieval`.
- Product screenshots use the `frame` template.

The manifest header in `assets/cards/cards.toml` lists every field.

## Add or change a card

1. If the logo is new, vendor it: `cards.py logo <name> lobehub:<icon>` (or `simple:<icon>`, `lucide:<icon>`, a URL or a path). Compare the mark with the brand's own site. Icon sets lag behind rebrands.
2. Add or edit the entry in `assets/cards/cards.toml`.
3. Run `cards.py render <id> --sheet`. Open the sheet and check the card at 4-column and 2-column widths.
4. Run `cards.py push <id>`. This needs `gcloud` auth with write access to the bucket. Objects are immutable, so a push never changes a live page.
5. Put `cards.py url <id>` in the `<Card img>`, or run `cards.py relink` to rewrite stale and legacy references.
6. Run `cards.py status --check`. It fails if the manifest, GCS and the MDX disagree.

To replace a legacy image, list its URL in `replaces` and run `relink`. If one legacy image covers several variants, give each variant a `title` or `href` regex.

## Change the design

Edit `scripts/card_design.py`. Its contents are part of every fingerprint, so every card gets a new name. Run `push`, then `relink`, and commit the MDX diff with the design change.
