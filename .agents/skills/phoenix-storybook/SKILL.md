---
name: phoenix-storybook
description: Conventions for creating, modifying, and reviewing production-faithful Storybook stories in the Phoenix frontend (js/app/stories, js/app/.storybook). Covers sidebar taxonomy and titles, the tag vocabulary, entry shape, option grids, component audits, overlays, toasts, themes, domain stories, and Storybook configuration. Use whenever touching `.stories.*` or story `.mdx` files, story fixtures, decorators, helpers in `stories/utils`, thumbnails, `.storybook/` configuration, or a frontend change that adds, changes, moves, or removes stories — including small or mechanical story edits and PR reviews that touch stories.
metadata:
  internal: true
---

# Phoenix Storybook

Stories exist to show how production components look and behave. This file
holds the rules that apply to every story change and routes to focused
references for the rest. Read only the references your task needs; each one
is self-contained.

Apply it alongside `phoenix-frontend`, `phoenix-design`, and
`phoenix-typescript` when those are relevant.

## Core rules (always apply)

1. **Render production truth.** Render the shipped component with its real
   types, providers, and behavior. Never write a lookalike inside a story
   file, and never invent content, states, controls, or behavior production
   does not support. If the production component cannot be rendered, delete
   the story rather than fake it. Mock only the narrow external boundary
   (network, Relay environment) that places the component in a real state.
2. **Three roots, grouped by subject.** Every title starts with
   `Design System/<Subject>/…`, `Domains/<Surface>/…`, or `Storybook/…`.
   Subjects are *what a reader is thinking about* (Tables, Overlays,
   Feedback), never abstraction tiers (foundations / core / patterns). The
   subject and surface lists live in `js/app/stories/_meta/taxonomy.ts`.
   Adding a root or subject is a taxonomy decision: raise it, do not invent
   one.
3. **Titles match paths.** `Design System/Overlays/Popover` lives at
   `js/app/stories/design-system/overlays/Popover.stories.tsx`. Leaves are
   spaced words; no `&` anywhere in a title.
4. **Tag every story on three axes**, as plain string literals: provenance
   (`legacy` | `updated`), completeness (`complete` | `incomplete`, required
   on `updated`), human review (`reviewed` | `unreviewed`). New or rewritten
   stories are `updated` + `unreviewed`. Only a human reviewer sets
   `reviewed` — never an agent, however confident.
5. **One entry per piece of content.** A file with one sidebar story tags it
   `!dev`. When all of a file's stories read well together on the Docs page,
   tag every one `!dev` so the Docs page is the component's only entry.
6. **Open on a compact `Default`,** then the option grids. A foundational
   component shows its whole accepted option space, including options that
   have no styling.
7. **States are their own axis,** crossed with other options in small
   pairwise `OptionGrid`s — never appended as one more column beside content
   or variant options. `pnpm lint:storybook` rejects the mixed form.
8. **Layers are shown open.** A menu, popover, tooltip, or dialog story shows
   the opened content, held open and non-dismissible; launch behavior gets
   exactly one separate `Interaction` story.
9. **Both themes, no horizontal scroll.** Choose `themeLayout` deliberately;
   any grid with more than one cell column takes `themeLayout: "column"`.
10. **No superfluous comments or docblocks.** A story docblock renders on the
    Docs page; most stories need none, and a grid's labels are its
    description. A `//` comment must say something the file cannot.
11. **Removal goes through review.** Propose each deletion or consolidation
    in writing and get an explicit ruling first; no bulk pruning.
12. **Run `pnpm lint:storybook`** (from `js/app`) after any story change. It
    enforces titles, paths, tags, `!dev`, `unused`, Overview naming, and the
    state-axis rule. Passing it is necessary, not sufficient.

## Route to the references

Read every row that matches the task. Paths are relative to this file.

| Task | Read |
|---|---|
| Authoring or rewriting a design-system component's stories | [component-audit](references/component-audit.md), [option-grids](references/option-grids.md), [entry-shape](references/entry-shape.md) |
| Component with variable text or a list of items | [content-length](references/content-length.md) |
| Menus, popovers, tooltips, dialogs, submenus, or anything held open | [overlays](references/overlays.md) |
| Toasts or toast regions | [toasts](references/toasts.md) |
| Choosing `themeLayout`, fixing a story in `Both` mode, portaled-layer theming | [themes](references/themes.md) |
| A story for one product surface (`Domains/…`), fixtures, mocks, many-state domain components | [domain-stories](references/domain-stories.md) |
| Choosing where an entry goes, adding a subject or subfolder | [taxonomy](references/taxonomy.md) |
| Creating, moving, or renaming a file or title; Overview pages; `storySort` | [files-and-titles](references/files-and-titles.md) |
| Writing or checking tags, `!dev`, `unused`, `autodocs` | [tags](references/tags.md) |
| Writing a docblock or code comment in a story file | [docblocks-and-comments](references/docblocks-and-comments.md) |
| Merging entries, deleting stories, regenerating thumbnails | [merging-and-removal](references/merging-and-removal.md) |
| Editing `.storybook/` (manager, sidebar, preview, Docs page) | [storybook-config](references/storybook-config.md) |
| Reviewing a PR or auditing a set of stories | [review](references/review.md), then the rows above for what it touches |
| Checking a story in a real browser | [verification](references/verification.md) |

A design-system story does not need the domain reference, and a domain story
does not need the Storybook configuration reference. Load what the change
touches.

## Workflow: authoring or rewriting a component entry

Copy this checklist and work through it:

```
- [ ] Read the component source; list what it accepts (component-audit)
- [ ] Place and title the file (taxonomy, files-and-titles)
- [ ] Compact `Default` first, then pairwise option grids (option-grids)
- [ ] Content-length and layer stories if the component has them
- [ ] Tags on all three axes; `!dev` per entry-shape
- [ ] Reread every docblock and comment you wrote; delete restatements
- [ ] `pnpm lint:storybook` passes
- [ ] Check `Both` mode for horizontal scroll and layer themes (verification)
```

The completeness tag records the audit: `complete` only when every item the
audit listed appears or is explicitly excluded with a reason.

## Keep this skill current

This skill is the durable home for Storybook conventions. When a maintainer
settles how content is grouped, named, ordered, or sized, rejects a story
shape, or names a failure mode — or when you find a rule here underspecified
for the case in front of you — update the matching reference in the same
change.

- Write the principle, not the incident: state the rule so the next author
  can apply it without the conversation that produced it, and say what it
  rules out. A short concrete example from the codebase helps; dates and
  names do not.
- Put a rule in the one reference a reader of that task would open. Promote
  it to **Core rules** only if nearly every story change needs it.
- Keep references one level deep from this file, and add new ones to the
  routing table.
