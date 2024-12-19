# Phoenix Experiment Runner

This is an example app that uses the phoenix-client and @clack/prompts to run experiments.

It runs against the `llama3.2` model, pointing to a local ollama instance.

## Setup

### Requirements

- [Phoenix](https://phoenix.arize.com/) running locally on `http://localhost:6006`
  - `pnpm d:up` will start Phoenix
  - Create a dataset from the `qa-dataset.csv` file in this directory in Phoenix at `http://localhost:6006/datasets`
- [Ollama](https://ollama.com/) with `llama3.2` installed OR OpenAI credentials configured in `.env`
  - You may copy the `.env.example` file to `.env` and fill in the values if you do not wish to use Ollama
- Node.js 20+
- pnpm

### Install dependencies

```bash
pnpm install
pnpm -r build
```

This will build all the dependencies in the monorepo and the app.

### Run the app

```bash
pnpm d:up
pnpm dev
```

This will start Phoenix at `http://localhost:6006` and the app in dev mode.

### Build the app

```bash
pnpm d:up
pnpm build
pnpm start
```

This will start Phoenix and build the app, then run the app.
