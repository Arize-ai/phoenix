# Post types

Starting shapes, not templates. Combine or bend them when the subject calls for it — the goal is one
clear point per post with the artifact that proves it. Name drafts and tags by these types (see
[typefully.md](typefully.md)).

## release

A version or a week of releases.

- **Source:** the release note page (`phoenix-release-notes` skill) or GitHub releases, verified
  against the code. Rank features with that skill's tiers; drop tier 5–6 unless they are the story.
- **X:** a thread. Post 1 is the headline feature with its asset. Posts 2–5 each carry one feature
  and at most one asset. The last post links the release note and gives the upgrade line
  (`pip install -U arize-phoenix` or the npm package). Skip the thread for a one-feature release.
- **LinkedIn:** one post. A first line naming the headline feature, 3–5 short lines (one per
  feature), the link, and one asset: the headline video, or a carousel with one slide per feature.
- **Assets:** one per headline feature; a code card for SDK/CLI features.

## feature

One capability, explained well.

- **Source:** the PR(s), the code, the docs page.
- **Shape:** what you can now do (first line), why (one clause), how (snippet or command), where
  (link). One asset.
- Use this for anything big enough that a release thread would undersell it.

## tip

A short how-to: a flag, a pattern, a filter query, an eval recipe. Works for features that shipped
a while ago.

- **Source:** docs pages and the code they describe.
- **Shape:** the problem in one line, the code card, one line on the result. No version line unless
  it is new.

## deep-dive

A thread that teaches one concept (how sessions group traces, how decision models score, how
retention works).

- **Source:** docs, the implementation, any design doc or blog.
- **Shape:** 4–8 posts. Each builds on the previous one, like an explainer storyboard. An explainer
  video or 1–3 diagrams carry it. End on what the reader can now do, with the docs link.

## integration

A new framework, provider, or tool integration.

- **Source:** the integration docs page, its runnable example, the instrumentor package.
- **Shape:** "Trace <framework> in Phoenix" plus the setup snippet and a trace screenshot. Tag the
  partner account only when confirmed.
- **Assets:** the `phoenix-docs` logo card for the brand, plus a real trace screenshot.

## community

Contributor shoutouts, milestones (stars, downloads, releases), talks, events, and meetups.

- **Source:** GitHub data (`gh api`), the event page, the contributor's PR.
- **Shape:** short and human. Say what the person did in concrete terms. A milestone states the
  number and what it reflects, without boasting.
- Use the user's details for events (time, place, link); never invent them.

## Other

Anything else (a benchmark, a hiring post, a docs launch, a migration notice) follows the same
rule: one point, the artifact that shows it, the right link. For breaking changes, say exactly what
breaks and link the migration guide; make no promotional framing.
