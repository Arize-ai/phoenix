# Merging and removing stories

## Removal requires a ruling

Consolidations and deletions are proposed in writing and approved one at a
time by a maintainer. For each candidate, record what it is, which review
axis it fails (see [review](review.md)), what replaces it, and what coverage
is lost — in the PR description, an issue, or the task's working notes — and
get a ruling before removing it. Bulk pruning is not available, even when the
presence failure looks obvious, and an `unused` tag is not a ruling.

Standing exceptions that need no ruling:

- collapsing a large set of small like items into one labeled list (see
  [option-grids](option-grids.md));
- deleting a fake — a story that renders a lookalike written in the story
  file instead of the shipped component.

## Merging two entries into one

When an approved merge folds one entry into another, the result must read as
one entry, not two files concatenated.

- **The whole absorbs the part.** Keep the primary component's file, title
  and meta `component`; the absorbed component goes in `subcomponents` and the
  docblock names it. A part (a disclosure arrow, a skeleton) becomes a section
  of its whole, never a peer entry. If the merged entry needs a new leaf,
  `git mv` the larger file so history follows.
- **Name for the combined entry.** The primary component keeps the plain
  story names; prefix absorbed stories with their sub-topic (`Range…`,
  `Deferred…`, `Skeleton…`, `Theme: …`) so they group. Rename a story that was
  clear only under its old title (`Default`, `Placeholder`, `All Colors`) even
  when nothing collides.
- **Meta settings do not travel.** The host's meta `render`, `args`,
  `decorators`, `layout` and controls now apply to every absorbed story, and
  the absorbed file's meta settings are gone. Move each onto the stories that
  need it or a shared base story they spread. A story that relied on its old
  meta's `component` (`Default: {}`) needs an explicit `render`, and a framing
  decorator can break a sibling that positions itself (a toast region).
- **Order by lifecycle,** not by the order the files were combined: loading
  before empty before populated.
- **Keep exactly one `Thumbnail`** and delete the absorbed file's images.
- **Provenance follows the content.** Carried-over stories stay `legacy`. A
  merge that rewrites stories into new stacks, or adds one, makes the file
  `updated`, which then needs a completeness claim.

## Regenerating thumbnails

`pnpm storybook:thumbnails <title-prefix>` (from `js/app`) rewrites every
image under the prefix. Images whose story did not change come back with one-
or two-level antialiasing differences. Keep only the images whose `Thumbnail`
story or component changed, and restore the rest from git so the diff shows
real changes only. Regenerate the images of any renamed file. Images are
always regenerated from the story, never edited.
