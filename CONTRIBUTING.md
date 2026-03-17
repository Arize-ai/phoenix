# Contributing to Arize-Phoenix

## Read This First

We are not actively accepting contributions right now.

You can still open an issue or PR, but please do so knowing there is a good chance we close it or never get to it.

We appreciate the impulse to contribute. This project is used by many people and we are trying to keep scope, quality, and direction tightly controlled. Limiting what we accept is how we do that.

## What We Are Most Likely To Accept

- Small, focused bug fixes.
- Small reliability fixes.
- Small performance improvements.
- Tightly scoped maintenance work that clearly improves the project without changing its direction.

## What We Are Least Likely To Accept

- Large PRs.
- Drive-by feature work.
- Opinionated rewrites.
- Anything that expands product scope without us asking for it first.

A 1,000+ line PR full of new features is very likely to be closed without review. Please don't put yourself through that.

## Opening A PR

- Keep it small.
- Explain exactly what changed.
- Explain exactly why the change should exist.
- Do not mix unrelated fixes together.
- If the PR makes anything resembling a UI change, include clear before/after images.
- If the change depends on motion, timing, transitions, or interaction details, include a short video.
- If we have to guess what changed, we are much less likely to review it.

## Issues First

If you are thinking about a non-trivial change, open an issue first.

That does not guarantee we will want the PR, but it gives us a chance to align before you invest the effort.

An open issue is not an invitation to submit a PR. Even if an issue is labeled or acknowledged, please wait for explicit confirmation from a maintainer before starting work on it. We track many issues we are not yet ready to address, and unsolicited PRs for them will likely be closed.

## Expectations

Opening a PR does not create an obligation on our side. We may close it, ask you to shrink it, or reimplement the idea ourselves later.

We know that can be frustrating. We would rather be upfront about it than waste your time with false encouragement.

## Code of Conduct

This project has adopted the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code and actions that violate it will not be tolerated.

## Branch Organization

Submit all changes to `main`.

Code that lands in `main` must be compatible with the latest stable release. It may contain additional features but no breaking changes. We should be able to release a new minor version from the tip of `main` at any time.

## Bugs

We use GitHub issues to track bugs. We keep a close eye on this and try to make it clear when we have an internal fix in progress. Before filing a new task, try to make sure your problem doesn't already exist.

## Pull Requests

Before submitting a pull request, please make sure the following is done:

- Fork the repository and create your branch from `main`.
- Follow the [development guide](./DEVELOPMENT.md) to setup your local environment.
- If you've fixed a bug or added code that should be tested, add tests!
- Ensure test suite passes (`tox run -e unit_tests` and `npm run test` for app changes)
- Make sure your code is formatted with `tox run -e ruff` and `pnpm --dir app run fmt` for app changes.
- Make sure your code lints with `npm run lint` for app changes.
- Run type checking with `make typecheck-python` and `npm run typecheck` for app changes.

### Pull Request (PR) Descriptions

A PR description is a public record of what change is being made and why it was made. It will become a permanent part of our version control history, and will possibly be read by many people other than your reviewers over the years. Follow the following guidelines when writing a PR description:

- Title: The title must conform to [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) format and must sufficiently describe the change. Since PR titles are used to form release notes, titles with generic or non-descriptive content ("Fix build.", "Add patch.") are not allowed.
- Issue: The first line of the description should contain a reference to the issue that the PR is solving. For example, `fixes #1234` or `resolves #1234`. While this is not required for urgent fixes, it is required for all other PRs so that the issue is clearly tracked and triaged by a core team member.
- Description: The first line should be a short, focused summary, while the rest of the description should fill in the details and include any supplemental information a reader needs to understand the change holistically. It might include a brief description of the problem that's being solved, and why this is the best approach. If there are any shortcomings to the approach, they should be mentioned.
- Videos and screenshots: Highlight the changes in the UI. These should be supplemental to the text description, not a replacement for it.
- Code Snippets: If the PR is changing an API, include code snippets to highlight the changes. This will expedite a reader's ability to construct the right API calls if they are interested in doing so. These should be supplemental to the text description, not a replacement for it.

## Contributor License Agreement (CLA)

In order to accept your pull request, we need you to submit a CLA. You only need to do this once. Simply reply to your first pull request with `I have read the CLA Document and I hereby sign the CLA`. Your signature will be recorded automatically in the `cla` branch.
