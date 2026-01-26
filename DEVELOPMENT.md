# Developer's Guide

- [Developer's Guide](#developers-guide)
  - [Setting Up Your macOS Development Environment](#setting-up-your-macos-development-environment)
  - [Testing and Linting](#testing-and-linting)
  - [Installing Pre-Commit Hooks](#installing-pre-commit-hooks)
  - [Contributing Notebooks](#contributing-notebooks)
  - [Contributing Documentation](#contributing-documentation)
  - [Building the Package](#building-the-package)
  - [Installing a Phoenix Build](#installing-a-phoenix-build)
  - [Installing a `git` Branch on Colab](#installing-a-git-branch-on-colab)
  - [Publishing a New Release](#publishing-a-new-release)
  - [Best Practices](#best-practices)
    - [REST API](#rest-api)
      - [HTTP Methods](#http-methods)
      - [Status Codes](#status-codes)
      - [Path Structure](#path-structure)
      - [Query Parameters](#query-parameters)
      - [Pagination](#pagination)
      - [Response Format](#response-format)

## Setting Up Your macOS Development Environment

We recommend using a virtual environment to isolate your Python dependencies. This guide will use `uv`, but you can use a different virtual environment management tool such as `conda` if you want.

**First**, ensure that your virtual environment manager is installed. For macOS users, we recommend installing `uv` via `brew` with

```
brew install uv
```

For non-mac users, you can follow the instruction [here](https://docs.astral.sh/uv/getting-started/installation/) to install `uv` for your particular operating system.

Create a new virtual environment. In general, we recommend developing on the lowest Python version compatible with Phoenix (currently 3.10) to make it easier to write code that is compatible across all supported versions.

```bash
uv venv --python 3.10
```

Activate your virtual environment before continuing.

```bash
source ./.venv/bin/activate
```

From the root of the repository, install the `arize-phoenix` package in editable mode (using the `-e` flag) with development dependencies (using the `dev` extra) by running

```bash
uv pip install -e ".[dev]"
```

Some parts of Phoenix—such as `phoenix.evals`, `phoenix.otel`, and `phoenix.client` developed as local packages located under the packages/ directory. These modules are excluded from the standard build process and are not installed automatically.

To make these modules available when working from source, run:

```bash
tox run -e add_symlinks
```

This command will create symbolic links inside src/phoenix/ pointing to the relevant submodules.

**Second**, install the web build dependencies.

We recommend installing [nodejs via nvm](https://github.com/nvm-sh/nvm) and then
installing `pnpm` globally to manage the web frontend dependencies.

```bash
# install nvm
# https://github.com/nvm-sh/nvm
# install node via nvm, our .nvmrc file will automatically instruct nvm to install
# the version specified in the file
nvm install
# set it as default (optional)
nvm alias default <version-that-was-installed>
# install pnpm globally for v22
npm i -g pnpm@9.15.5
```

Then we will build the web app. Change directory to `app` and run:

```bash
pnpm install
pnpm run build
```

## Testing and Linting

Phoenix is backed with either a `sqlite` or `postgresql` database. By default, tests that involve
persistence in some way run against both backends. Ensure that `postgresql` is installed on your
system.

```bash
brew install postgresql
```

Ensure your environment is set up so that `pg_config` points to the correct binary.

```bash
pg_config --bindir
```

This command should point to the `homebrew` install of `postgresql`, if it doesn't, try creating
a fresh Python environment or modifying your `PATH`.

Phoenix uses `tox` to run linters, formatters, type-checks, tests, and more. In particular, we are using `tox-uv`, which uses `uv` under the hood for package management and is significantly faster than vanilla `tox`.

You can install `tox-uv` globally with

```bash
pip install tox-uv
```

`tox` manages isolated virtual environments, each with a corresponding set of commands. These environments are defined inside of `tox.ini` and can be enumerated by running

```bash
tox list
```

Commands corresponding to an environment can be executed by running `tox run -e <env-name>`. For example, you can execute unit tests by running

```bash
tox run -e unit_tests
```

By default, database tests only run against `sqlite`, in order to run database tests against
a `postgresql` database as well, use the `--run-postgres` flag

```bash
tox run -e unit_tests -- --run-postgres
```

Check the output of `tox list` to find commands for type-checks, linters, formatters, etc.

## Installing Pre-Commit Hooks

First, install `pre-commit` globally. It is recommended to accomplish this using `uv`.

```bash
uv tool install pre-commit --with pre-commit-uv
```

Then install the project pre-commit hooks with

```bash
pre-commit install
```

Once installed, the pre-commit hooks configured in `.pre-commit-config.yaml` will automatically run prior to each `git commit`. Pre-commit hooks can be skipped by passing the `-n`/ `--no-verify` flag to the `git commit` command.

## Contributing Notebooks

To add or modify a Jupyter notebook, the following commands are needed to pass CI.

- `tox run -e ruff`: Runs formatters
- `tox run -e clean_jupyter_notebooks`: Removes cell output and notebook metadata to keep the diff as small as possible

## Contributing Documentation

Phoenix documentation is built using [Mintlify](https://mintlify.com/). The documentation source files are located in the `docs/` directory.

### Getting Started

1. Install the Mintlify CLI:

```sh
npm i -g mint
```

2. Run the local development server:

```bash
mint dev
```

3. Open your browser to `http://localhost:3000` to preview your changes.

### Making Changes

- Documentation pages are written in MDX (Markdown with JSX support).
- The `docs.json` file controls navigation and site-wide settings.
- Images and other assets should be placed in the appropriate subdirectories.

For more details on Mintlify's features, including formatting, components, and deployment, see the [Mintlify Quickstart Guide](https://www.mintlify.com/docs/quickstart).

## Building the Package

To build Phoenix, you must build the `app` and the python package.

To build the `app`, navigate to the `app` directory and run

```bash
pnpm run build
```

Then, from the root directory of the repo, run

```bash
hatch build
```

If successful, a source distribution (a tarball) and a Python `wheel` will appear in the `dist` folder at the repo base directory.

## Installing a Phoenix Build

We recommend using a separate virtual environment (e.g., `phoenixtest`) for installing and testing the builds created above.

To install Phoenix from the source distribution (i.e., tarball), run

```bash
pip install /path/to/source/distribution/tarball.tar.gz
```

To install Phoenix from the Python `wheel`, you must first install `wheel` with

```bash
pip install wheel
```

Then run

```bash
pip install /path/to/wheel.whl
```

(You should only install one of the source distribution or the `wheel` at a time.)

To make sure everything works, install `jupyter` with

```bash
pip install jupyter
```

and run the notebooks in the `tutorials` directory.

## Installing a `git` Branch on Colab

The code below installs the `main` branch in [Colab](https://colab.research.google.com/notebooks/empty.ipynb) and takes roughly 3 minutes to run.

```jupyterpython
!npm install -g -s n
!n latest
!npm install -g -s npm@latest
%pip install git+https://github.com/Arize-ai/phoenix.git@main
```

## Publishing a New Release

To publish a new release, follow the steps below.

1. Make sure your branch is up-to-date with `main`
2. Update the version number in `src/phoenix/version.py`
3. Remove the `dist` folder with `rm -rf dist`.
4. By default, the web app is not rebuilt. Change directory to `app` and run `rm -rf node_modules && pnpm install --frozen-lockfile && pnpm run build` to rebuild the web app.
5. From the root directory of the repo, build the package with `hatch build`.
6. Publish the package with `hatch publish -u __token__`. Note you must publish using a pypi token. The token should be stored securely in your `.pypirc` file (see [docs](https://packaging.python.org/en/latest/specifications/pypirc/))
7. Commit the changes using the version number as the message (e.x. `0.0.1`) and get it into to `main`
8. Using the [GitHub CLI](https://cli.github.com/), create a draft release with `gh release create <version> --generate-notes --draft`
9. Edit the release notes as needed and publish the release. This will trigger a slack notification to the `#phoenix-releases` channel.
10. A conda-forge PR will be automatically created. If the PR is not created, you can create it manually by following the instructions [here](https://conda-forge.org/docs/maintainer/updating_pkgs.html#forking-and-pull-requests).

## Best Practices

### REST API

- The API should communicate over JSON unless otherwise specified by the URL.
- The API should be versioned. If a backwards incompatible change is made, the new route should be nested under a new version.

#### HTTP Methods

- **GET** Used to retrieve a representation of a resource.
- **POST** Used to create new resources and sub-resources.
- **PUT** Used to update existing resources. Use PUT when you want to replace a resource.
- **PATCH** Used to update existing resources. Use PATCH when you want to apply a partial update to the resource.
- **DELETE** Used to delete existing resources.

#### Status Codes

- **4xx** The client application behaved erroneously - client error
- **5xx** The API behaved erroneously - server error
- **2xx** The client and API worked

#### Path Structure

- Use nouns for resources and sub-resources.
- Avoid using verbs in the path.
- Nouns should be pluralized and followed by a globally unique identifier for specific resources (e.g., `/datasets/:dataset_id` where the dataset ID is the globally unique identifier consistent with the GraphQL API).

#### Query Parameters

Use query parameters for filtering, sorting, and pagination. Query parameters should use `_` as a separator.

#### Pagination

Use cursor-based pagination. Each request gives a cursor to the next page of results.

#### Response Format

- The response should be a JSON object with a `data` key.
- Payload content should use snake case to make it easier to work with when translating to objects.

## Cursor / VS Code

A recommended list of extensions for Cursor/VSCode is located in the `.vscode/extensions.json` file.
When opening Phoenix in Cursor, you will automatically be prompted to install the recommended extensions.
After doing so, consider pasting the following settings into your workspace settings at `.vscode/settings.json` to make sure the extensions work when Phoenix is opened at the root of the monorepo.

```json
{
  "python.languageServer": "Default",
  "mypy-type-checker.importStrategy": "fromEnvironment",
  "[python]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.ruff": "always"
    }
  },
  "mypy-type-checker.ignorePatterns": [".tox,.venv,app"],
  "javascript.preferences.importModuleSpecifier": "shortest",
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "prettier.configPath": "app/.prettierrc.json",
  "prettier.prettierPath": "app/node_modules/prettier",
  "typescript.tsdk": "app/node_modules/typescript/lib",
  "relay.rootDirectory": "app",
  "relay.pathToConfig": "app/relay.config.js",
  "relay.autoStartCompiler": true
}
```

### Debugging the Python Server

The dev server runs with `debugpy` enabled, allowing you to attach a debugger from VS Code or Cursor.

1. **Create a launch configuration** at `.vscode/launch.json`:

   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Attach to Phoenix Dev Server",
         "type": "debugpy",
         "request": "attach",
         "connect": {
           "host": "localhost",
           "port": 5678
         },
         "justMyCode": false
       }
     ]
   }
   ```

2. **Start the dev environment** from the `app` directory:

   ```bash
   pnpm dev
   ```

   This launches both the Python server and the frontend UI simultaneously using `mprocs`. The server will start with debugpy listening on port 5678.

   > **💡 Tip:** Use in-memory SQLite for a fresh database without affecting your existing on-disk data:
   > ```bash
   > PHOENIX_SQL_DATABASE_URL=sqlite:///:memory: pnpm dev
   > ```

3. **Set breakpoints** by clicking in the gutter (left of line numbers) in any Python file.

4. **Attach the debugger**:
   - Press `⇧⌘D` (macOS) or `Ctrl+Shift+D` (Windows/Linux) to open the Run and Debug panel
   - Select **"Attach to Phoenix Dev Server"** from the dropdown
   - Press `F5` or click the green play button

5. **Trigger your code** by making a request to the server via the UI or API.

6. **Debug**: When a breakpoint is hit, use the debug toolbar to step through code:
   - `F10` — Step over
   - `F11` — Step into
   - `F5` — Continue
   - Inspect variables in the left panel or evaluate expressions in the Debug Console
