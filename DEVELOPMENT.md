# Development

## Getting Started

This tutorial shows you how to:
- Set up your development environment,
- Run scripts using `hatch`,
- Run `phoenix` from source,
- Build the `phoenix` package.

### Set Up Development Environment

Set up your development environment using `pyenv` and `virtualenvwrapper`. If you do not have Python 3.10 already installed, run
```shell
export PHOENIX_PYTHON_VERSION=3.10.8
pyenv install $PHOENIX_PYTHON_VERSION
```
Set the global `pyenv` version with
```shell
pyenv global $PHOENIX_PYTHON_VERSION
```
Create a new virtual environment with
```shell
mkvirtualenv phoenix-env
```
Install development dependencies with
```shell
pip install -r requirements-dev.txt
```

### Learn to Run Scripts with `hatch`

`hatch` is the project management tool used to build `phoenix`. After installing and activating the `phoenix-env` virtual environment, view the project environments, dependencies and scripts defined in `pyproject.toml` with
```shell
hatch env show
```
Scripts belonging to the various environments can be run with
```shell
hatch run <env-name>:<script-name>
```
For example, you can check types with
```shell
hatch run type:check
```
You can fix styles with
```shell
hatch run style:fix
```
You can run tests with coverage with
```shell
hatch run test:coverage
```

### Build the `phoenix` Package

To build `phoenix`, run
```shell
hatch build
```
If successful, the build will appear in the `dist` folder at the repo base directory.

## Useful Resources
- [Hatch Quickstart](https://hatch.pypa.io/latest/)
- [Hatch CLI Reference](https://hatch.pypa.io/latest/cli/reference/)
