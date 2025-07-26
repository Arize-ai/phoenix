# Phoenix TS

Typescript packages for interfacing with Phoenix and evaluating LLM applications.

## Packages

### [phoenix-client](./packages/phoenix-client/)

Provides a client and utilities for interacting with the phoenix application.

## Examples

### [notebooks](./examples/notebooks/)

A collection of Deno Jupyter notebooks that demonstrate how to interact with Phoenix using JavaScript.

### [phoenix-experiment-runner](./examples/apps/phoenix-experiment-runner/)

An example app that uses the phoenix-client and @clack/prompts to run experiments interactively.

## Development Guide

Below is how to setup the tooling for the JS monorepo.

## PNPM

This repository is managed as a monorepo using [pnpm workspaces](https://pnpm.io/workspaces). Follow these steps to get your environment set up:

### 1. Install pnpm (if you don't have it)

```sh
npm install -g pnpm
```

### 2. Install all dependencies for all packages

From the root of the repository, run:

```sh
pnpm install
```

This will install dependencies for all packages in the monorepo.

### 3. Run scripts across all packages

You can run scripts (like build, lint, test, prettier) across all packages using pnpm's recursive mode:

```sh
pnpm run -r build      # Build all packages
pnpm run -r lint       # Lint all packages
pnpm run -r test       # Run tests for all packages (if defined)
pnpm run -r prettier:check # Check formatting for all packages
```

### Changesets

The changes to the packages managed by this repo are tracked via changesets. Changesets are similar to semantic commits in that they describe the changes made to the codebase. However, changesets track changes to all the packages by committing changesets to the `.changeset` directory. If you make a change to a package, you should create a changeset for it via:

```sh
pnpm changeset
```

and commit it in your PR.

A changeset is an intent to release a set of packages at particular semver bump types with a summary of the changes made.

Once your PR is merged, Github Actions will create a release PR. Once the release PR is merged, new versions of any changed packages will be published to npm.

For a detailed explanation of changesets, consult the [official documentation](https://github.com/changesets/changesets).
