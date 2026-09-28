# Docblocks and comments in story files

Story files repeat the same few mechanisms (tags, controls, parameters)
across dozens of files and invite the same comment every time. A restating
comment or docblock is a conspicuous, clichéd failure mode. Neither
`pnpm lint:stories` nor any other check catches it, so reread every docblock
and comment you wrote before finishing.

## Story docblocks are content

A `/** … */` on a story export or on `meta` renders on the Docs page as that
story's or component's description. Write it for the Docs page reader: what
the story shows, what the states mean, when to choose each. Never use it to
justify the story's construction to a reviewer.

**Most stories need no docblock**, and a grid story defaults to none — its row
and column labels are its description. Delete a docblock that:

- restates the story's name or what the grid plainly shows ("Every state at
  every size", "A value longer than the field, to show how it overflows");
- explains why the story exists ("…to confirm this is the component you
  want");
- reports what the author noticed in the rendered grid, however precise ("a
  read-only field has no clear button", "the quiet variant has no border").
  Test each sentence: could a reader who studies the story say it without
  reading the source? If so, delete it;
- gives usage guidance drawn from call sites ("Phoenix puts it in menu
  headers"). In the rare entry with an `Example Usage` story, that story shows
  it;
- contains measurements ("21px tall against 25px") — they go stale when a
  token changes;
- describes a defect ("a disabled group is dimmed twice"). File an issue,
  where it can be tracked and closed; the grid already shows the defect.

Keep a docblock only when it tells the reader something the rendered story
cannot, as `With Children` does ("The label accepts rich content, not only a
string"). Two standing exceptions:

- naming which accepted options have no styling and what they render as (see
  [component-audit](component-audit.md));
- on a constraint story, saying which prop sets the constraint, its default,
  and the values to pass (see [content-length](content-length.md)).

## `//` comments

A `//` comment must say something the file cannot: a surprising library
behavior ("React Aria reads an item's `id`, not React's `key`"), an external
constraint, or a workaround and what it works around. A fact for someone
editing the story belongs in a `//` comment at the line it explains, not on
the Docs page.

- **Never narrate a tag, parameter, or setting** — no `// hide from the
  sidebar` beside `tags: ["!dev"]`, no `// every cell is a fixed combination`
  beside `controls: { disable: true }`. The vocabulary is documented once, in
  this skill and the `Storybook/` pages.
- **Never explain what the type system enforces.** A list keyed by
  `Record<SandboxBackendType, true>` needs no comment saying a missing entry
  is a type error.
