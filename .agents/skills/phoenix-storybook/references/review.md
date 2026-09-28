# Reviewing stories

The shared vocabulary for authoring and reviewing a PR that touches stories.
After judging the set on these axes, check the specific rules in the
references for what the PR touches (see the routing table in `SKILL.md`).

## Five independent axes

A story set can pass four and fail one.

- **Presence** — does the content deserve to be in Storybook? A story for a
  narrow, situational, or one-off component is noise that makes the important
  components harder to find. (`unused` is a presence signal; see
  [tags](tags.md).)
- **Absence** — are commonly used components represented at all? A widely
  consumed primitive with no story is a worse defect than a mediocre story on a
  rare one.
- **Balance** — are a component's story count and size proportional to its
  importance and genuine variation? Both directions are defects: a situational
  component with dozens of stories, and a foundational component whose stories
  omit variation it exposes. Judge by sidebar entries and what each story
  shows, not line count.
- **Thoroughness** — do the stories teach? Rendering a state is not
  documenting it; the reader should see what the states are and be able to
  choose between them.
- **Organization** — is content findable? Coherent subjects, one home per
  concept, titles that predict location (see [taxonomy](taxonomy.md)).

**Name the axis in review comments.** "This is a balance problem: `Popover`
exposes modality, placement, flipping, and arrow behavior and has one story" is
actionable; "needs more stories" is not.

## Review checklist

```
- [ ] Each changed file renders shipped components only — no lookalikes
- [ ] Title matches path; placed by subject (taxonomy, files-and-titles)
- [ ] All three tag axes present; `reviewed` not set by an agent (tags)
- [ ] `!dev` applied per entry-shape; compact first story
- [ ] Option space matches the component source (component-audit)
- [ ] No state values mixed into other axes; grids pairwise (option-grids)
- [ ] Layers held open; one `Interaction` story (overlays)
- [ ] No restating docblocks or comments (docblocks-and-comments)
- [ ] No horizontal scroll in `Both` mode (themes)
- [ ] Deletions each have a ruling (merging-and-removal)
- [ ] `pnpm lint:stories` passes
```
