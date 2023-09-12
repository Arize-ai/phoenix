# Arize Phoenix App

The Phoenix application is a web application built to enable rapid troubleshooting and EDA of model inferences and LLM applications. It is hosted by the phoenix server and also consumes the GraphQL API served by the python runtime as well.

## Installation

To build and develop the web application, you must first install the dependencies via `npm`. This will require a recent install of `nodejs` as well.

```shell
npm ci
```

## Develop

To develop the UI, you must run the `app` in conjunction with the backend server. You can start the application in development mode via the following:

```
npm run dev
```

Depending on what flows you are trying to build features for, you may want to adjust the scripts block within the `package.json` file so that the server is serving the appropriate fixture data.

## Build

The app is written in `typescript` and leverages `esbuild` as well as the `relay-compiler` to compile highly efficient `graphql` queries. Because of this, the build script involves:

1. Building the `javascript` and `css` assets using `esbuild`
2. Building the compiled graphql queries using the `relay-compiler`
3. Building the static assets - e.g. scaffolding the server static serving directory

The web build ensures that the UI as well as the data-fetching layer is fully type safe with regards to the GraphQL schema. The type safety of the application is statically validated via the typescript CI pipeline.


## Test

The Phoenix app is statically analyzed for type safety via `typescript`, statically analyzed for best practices via `eslint`, and the formatting is enforced bia the `prettier` code formatter. In addition to static type checking, the app also leverages `jest` as a unit testing framework. The following `npm` commands correspond to the above safeguards.

```shell
npm run typecheck
npm run lint
npm run prettier:check
npm run test
```
NB: `prettier` is also enforced via `precommit` hooks.

## Architecture

The Phoenix app is a `react` application built on top of a `graphql` API. The data-fetching for the API is managed via `react-relay`, an opinionated data fetching and storage library. The API contract between the server and the app is managed via a `schema.graphql` file stored at the root of this directory. The schema is generated via server build scripts. Similarly the queries against the schema are compiled via the `relay-compiler`. `relay` allows the application of colocate the data requirements of components with the components itself, enabling maximal efficiency and clarity as to how data flows through the system.

Within the `react` app, there is additional `state` and `context` that is managed via `react`'s built-in hooks. In addition to `react`'s built-in state management, `zustand` is also leveraged as central store to manage the data for the point-cloud visualization. `zustand` provides a highly scalable way to manage a large amount of state across components without paying a performance penalty when sub-parts of the state changes due to user interaction.

The phoenix app is a client-side only SPA (single-page application), meaning that it entirely manages the routing of the pages via `react-router`. `react-router` is leveraged to provide nested routing (e.g. rendering different parts of the UI based on the path) and is also leveraged to load data as routes change (see `loaders`).