# Development

## Getting Started

This tutorial shows you how to:
- Install `hatch`,
- Run `phoenix` from source,
- Build the `phoenix` package,
- Run scripts using `hatch`.

### Install `hatch`

We will first install [hatch](https://hatch.pypa.io/latest/), the Python project management tool used to develop and build `phoenix`. Among other things, `hatch` is a package and environment management tool. As such, it is not typically installed in the same virtual environment as `phoenix` package dependencies such as `numpy` or `pandas` or development dependencies such as `pytest` or `jupyter`, since it creates and manages the virtual environments containing such dependencies.

While it is possible to install `hatch` globally, we recommended to install `hatch` in its own virtual environment. If you have yet to set up your Python development environment or are unfamiliar with virtual environments, follow [these instructions](https://github.com/Arize-ai/arize/blob/main/python/README.md) to get started with `pyenv` and `virtualenvwrapper`. Once you have created and activated a virtual environment (e.g., `hatch-env`), install `hatch` with
```shell
pip install hatch
```
Before proceeding, ensure that `hatch` is accessible from the command line by running
```shell
hatch
```

### Run `phoenix` from Source

To run `phoenix` from source, create a virtual environment containing `phoenix` package and development dependencies with
```shell
hatch env create develop
```
Run
```shell
hatch env find develop
```
to find the path to this virtual environment. After configuring your IDE to use the Python interpreter in this environment, run the notebooks in the `examples` directory.

### Build the `phoenix` Package

To build `phoenix`, run
```shell
hatch build
```
If successful, the build will appear in the `dist` folder at the repo base directory.

### Learn to Run Scripts with `hatch`

Scripts belonging to the various environments displayed with `hatch env show` can be run with
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
The first time you run a script, `hatch` will automatically create the corresponding virtual environment on the fly if it does not already exist. In other words, it's not necessary to run `hatch env create type` before running `hatch run type:check`.

## Useful Resources
- [Hatch Quickstart](https://hatch.pypa.io/latest/)
- [Hatch CLI Reference](https://hatch.pypa.io/latest/cli/reference/)
