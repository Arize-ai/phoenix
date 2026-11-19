# Voice

Phoenix posts read like an engineer on the team telling other engineers what just shipped and why
it matters to them. Calm, specific, a little dry. The reader is building LLM apps or agents and has
seen every launch-post cliché.

## Do

- **Lead with the capability, in concrete terms.** "`px prompt tag` moves a tag between prompt
  versions from the terminal." Not "Big news for prompt management!"
- **Show, then name.** Real code, a real command, a real number, a real span name. The specific
  example is the hook.
- **Say why it exists.** One clause of the problem it solves, in the author's words where possible:
  "so a deploy script can promote a prompt without opening the UI."
- **Use exact names.** UI labels, functions, flags, and package names as they appear in the code.
- **Credit people.** "Thanks to @handle for the PR" when a community member built it, in the post
  about that feature. Use the handle `scripts/lookup-handles.sh` confirms, or the person's name.
- **Write short sentences.** One idea each. Line breaks between ideas on LinkedIn.
- **"We" for the team, "you" for the reader.** "We added…" / "You can now…"

## Don't

- Hype words: powerful, seamless, game-changer, revolutionary, supercharge, unlock, elevate, robust,
  cutting-edge, next-level, effortless.
- Openers: "Excited to announce", "We're thrilled", "Big news", "Introducing…!", "Ever wondered…?",
  "Here's the thing", "Let's dive in".
- Engagement bait: "Thoughts?", "Drop a 🔥", "Like and RT", "🧵👇", "A thread:".
- Rhetorical questions and exclamation marks. One exclamation mark per post at most, and only for a
  real milestone.
- Patterns that read as generated: "It's not just X — it's Y", stacked triads ("faster, simpler,
  and smarter"), em-dash chains, a closing line that restates the opener.
- Emoji as bullets or decoration. A single functional emoji is fine when it carries meaning (for
  example a terminal or a package), never as a wall.
- Hashtags on X. On LinkedIn, at most two, at the end, only if they name a real topic
  (`#OpenTelemetry`, `#LLMOps`).
- Competitor names, comparisons, or links to other observability or eval products.
- Internal detail: module paths, PR numbers instead of value, internal tooling, repo-internal skills.

## Calibration

Weak:

> 🚀 Excited to announce a powerful new way to manage your prompts! Phoenix now supercharges your
> prompt workflow with tagging from the CLI. Check it out! 👇

Strong:

> Promote a prompt from your deploy script:
>
> `px prompt tag <version-id> --tag production`
>
> Creates the tag, or moves it if another version has it. New in @arizeai/phoenix-cli 1.23.

The strong version names the command, shows it, says what it does in one line, and states the
version. It needs no adjectives.

## Author intent

Before writing, answer: what was the author annoyed by, and what can a user now do in one step that
took several before? That answer is usually the first line. If the PR description contains a line
that says it well, use it nearly verbatim.
