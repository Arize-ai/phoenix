# Contributing to Arize-Phoenix

`arize-phoenix` is an open source project that is under active development that is being used by Arize AI customers as well as the larger AI community. This document aims to make it easy for anyone to contribute to the project.

## Code of Conduct

This project has adopted the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code and actions that violate it will not be tolerated.

## Branch Organization

Submit all code changes to `main` and documentation changes to the `docs` branch.

Code that lands in `main` must be compatible with the latest stable release. It may contain additional features but no breaking changes. We should be able to release a new minor version from the tip of `main` at any time.

## Bugs

We use GitHub issues to track bugs. We keep a close eye on this and try to make it clear when we have an internal fix in progress. Before filing a new task, try to make sure your problem doesn’t already exist.

## Pull Requests

The core team is monitoring for pull requests. We will review your pull request and either merge it, request changes to it, or close it with an explanation.

Before submitting a pull request, please make sure the following is done:

-   Fork the repository and create your branch from `main`.
-   Follow the [development guide](./DEVELOPMENT.md) to setup your local environment.
-   If you've fixed a bug or added code that should be tested, add tests!
-   Ensure test suite pass. (`hatch run tests` and `npm run test` for app changes)
-   Make sure your code is formatted with `hatch run style:fix` and `npm run prettier` for app changes.
-   Make sure to your code lints with `npm run lint` for app changes.
-   Run type checking with `hatch run type:check` and `npm run typecheck` for app changes.

### Pull Request Descriptions

A PR description is a public record of what change is being made and why it was made. It will become a permanent part of our version control history, and will possibly be read by many people other than your reviewers over the years. Follow the following guidelines when writing a PR description:

-   Title: The tile must conform to [conventional commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) format and must sufficiently describe the change. Since PR titles are used to form release notes, titles with generic or non-descriptive content (“Fix build.”, “Add patch.”) are not allowed.
-   Issue: The first line of the description should contain a reference to the issue that the PR is solving. For example, `fixes #1234` or `resolves #1234`. While this is not required for urgent fixes, it it is required for all other PRs so that the issue is clearly tracked and triaged by a core team member.
-   Description: The first line should be a short, focused summary, while the rest of the description should fill in the details and include any supplemental information a reader needs to understand the change holistically. It might include a brief description of the problem that’s being solved, and why this is the best approach. If there are any shortcomings to the approach, they should be mentioned.
-   Videos and screenshots: Highlight the changes in the UI. These should be supplemental to the text description, not a replacement for it.
-   Code Snippets: If the PR is changing an API, include code snippets to highlight the changes. This will expedite a reader's ability to construct the right API calls if they are interested in doing so. These should be supplemental to the text description, not a replacement for it.

### Small Simple Pull Requests

Small, simple pull requests are important because they are:

-   Reviewed more quickly
-   Reviewed more thoroughly
-   Less likely to introduce bugs
-   Easier to merge.
-   Easier to design well
-   Less blocking on reviews
-   Simpler to roll back

Note that reviewers have discretion to reject your change outright for the sole reason of it being too large. Usually they will thank you for your contribution but request that you somehow make it into a series of smaller changes. It can be a lot of work to split up a change after you've already written it, or require lots of time arguing about why the reviewer should accept your large change. It's easier to just write small PRs in the first place.

For a comprehensive guide on how to write small PRs, see this [guide](https://github.com/google/eng-practices/blob/master/review/developer/small-cls.md)

## Contributor License Agreement (CLA)

In order to accept your pull request, we need you to submit a CLA. You only need to do this once. Simply reply to your first pull request with `I have read the CLA Document and I hereby sign the CLA`. Your signature will be recorded automatically in the `cla` branch.

## Code Reviews

A code review is a process where someone other than the author(s) of a piece of code examines that code. Code committed to the codebase is both the responsibility of the author and the reviewer. Code reviews should look at:

-   Design: Is the code well-designed and appropriate for your system?
-   Functionality: Does the code behave as the author likely intended? Is the way the code behaves good for its users?
-   Complexity: Could the code be made simpler? Would another developer be able to easily understand and use this code when they come across it in the future? Can multiple
-   Tests: Does the code have correct and well-designed automated tests?
-   Naming: Did the developer choose clear names for variables, classes, methods, etc.?
-   Comments: Are the comments clear and useful?
-   Style: Does the code follow our style guides? Note, in most cases, style nits should be avoided and be enforced entirely by automated tooling. However some stylistic decisions can be discussed if it impacts readability and complexity.
-   Documentation: Did the developer also update relevant documentation?

All of the above are grounds for a reviewer to request changes in a PR. Consensus should be reached to the best of the abilities of the author and reviewer. However, if consensus cannot be reached between the two parties, the review should be escalated to the technical lead.

### Code Review Conduct

-   Be kind.
-   Explain your reasoning.
-   Balance giving explicit directions with just pointing out problems and letting the developer decide.
-   Encourage developers to simplify code or add code comments instead of just explaining the complexity to you.

Remember that you are both on the same team and are working towards the same goal. The goal is not to make the code perfect, but to make it better. Make sure your comments are constructive and actionable. Treat the code diff as an non-personal artifact under inspection rather than a personal creation. For a comprehensive guide on how to provide effective PR feedback, see this [guide](https://google.github.io/eng-practices/review/reviewer/comments.html).
