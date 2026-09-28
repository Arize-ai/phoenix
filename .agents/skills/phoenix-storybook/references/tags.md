# Tags

Tags keep the health of the story set visible in the sidebar. The vocabulary
lives in `js/app/stories/_meta/tags.ts`; `pnpm lint:stories` enforces it and
the sidebar chips render it (see [storybook-config](storybook-config.md)).

## Contents

- The three axes
- Defaults
- The `unused` flag
- Writing tags so Storybook sees them
- What tags are not for

## The three axes

The axes are independent: a legacy story can be complete, an updated one
unreviewed.

| Axis | Values | Meaning |
|---|---|---|
| Provenance | `legacy` \| `updated` | `legacy` predates the current story conventions, **including a story that was only moved or renamed** — relocation does not make it updated. `updated` was authored or rewritten to them. |
| Completeness | `complete` \| `incomplete` | Parity with the component's states (see [component-audit](component-audit.md)), not polish. `incomplete` means something is knowingly missing. |
| Human review | `reviewed` \| `unreviewed` | `reviewed` means a human maintainer manually verified the story is correct. Nothing else sets it — not an agent, a passing lint run, or a careful self-check. |

Both sides of each axis are tagged explicitly. An untagged axis is an error,
not a default, because "nobody set this" and "this is the negative case" must
not look alike. That also makes every axis queryable from Storybook's
built-in tag filter menu.

## Defaults

- `unreviewed` for everything, including stories an agent just wrote and
  believes correct.
- `legacy` for every pre-existing story; it survives relocation and
  retitling.
- Completeness is required on `updated` stories and optional on `legacy`
  ones. `incomplete` asserts that someone compared the stories against the
  component; a mechanical relocation has no basis for a claim either way, so
  it makes none.

Rewriting a story, or adding one to a file, makes the file `updated` and
requires a completeness claim.

## The `unused` flag

`unused` marks an entry whose component nothing in production renders. It is
a boolean flag with no `used` counterpart — "used" is the normal case, and a
chip saying so everywhere would be noise. It is the deliberate exception to
tagging both sides, and it is safe because it is derived, not asserted:

`pnpm lint:stories` resolves each file's `meta.component` to an `@phoenix/…`
import and searches `src/` for any reference other than its declaration,
imports and re-exports (the declaring file counts, since many components are
rendered only by their own module). It fails when an unrendered component
lacks the flag or a rendered one carries it. Files whose subject is not one
resolvable component — palettes, reference pages, story-local compositions —
are not checked; tag those by hand only after searching `src/` yourself.

`unused` is a presence finding, not a verdict. It does not license deleting
the story; propose removal through review like any other (see
[merging-and-removal](merging-and-removal.md)), since the component may be
about to be adopted.

## Writing tags so Storybook sees them

- Write tags as plain string literals: `tags: ["legacy", "unreviewed"]`. Do
  not import the constants from `tags.ts`: Storybook parses CSF statically, so
  `tags: [provenance.legacy]` fails indexing with
  `CSF: Expected tag to be string literal`, and a `satisfies` clause fails
  too.
- Write a story's tags on its own export. When a helper builds several
  stories, spread it and add the tags beside the spread
  (`{ ...familyStory("gray"), tags: ["!dev"] }`); tags returned from the
  helper are invisible to the indexer, and the story silently stays in the
  sidebar.
- `!dev` hides a story from the sidebar but keeps it on the Docs page. When to
  use it is in [entry-shape](entry-shape.md).
- Do not add `autodocs` to a story file; `preview.tsx` sets it globally.
  Verify that against a static build (`storybook build`, then read
  `index.json`) rather than a dev server's index.

## What tags are not for

Tag arrays like `["prod", "us-east-1"]` or `["llm", "agent", "production"]`
are fixture data and belong in the component's props. In Storybook's tag
namespace they pollute the sidebar filter menu for everyone.
