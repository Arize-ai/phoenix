# Phoenix Development

## Getting Started

### Install Project Management Tool

Install [Hatch](https://hatch.pypa.io/latest/), the Python project management tool used to develop and build Phoenix.
```shell
pip install hatch
```
The environment in which Hatch is installed is distinct from the Phoenix development environment. One recommended approach is to install Hatch in its own virtual environment. Ensure that Hatch is accessible from the command line before proceeding.

### View Environments and Run Scripts

View the environments defined in `pyproject.toml` with
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
The first time you run a script, `hatch` will automatically create the corresponding environment if it does not already exist.

### Build Phoenix

To build Phoenix, run
```shell
hatch build
```
If successful, the build will appear in the `dist` folder at the repo base directory.

### Install the Build

Given a successful build, Phoenix can be installed by creating and activating a new virtual environment and running
```shell
pip install -e .
```
from the repo base directory to install the package in development mode.

### Test Your Installation

To test your installation, install Jupyter in the same environment in which you installed `phoenix` with
```shell
pip install jupyter
```
and run the notebooks in the `examples` directory.

## Troubleshooting

If you are using an Apple M1 machine and encounter the error `Could not find a local HDF5 installation` while running a `hatch` command, take the following steps:
1. Install HDF5 with `arch -arm64 brew install hdf5`.
2. Find the path to your HDF5 installation with `brew info hdf5`.
3. Set an environment variable with `export HDF5_DIR=/path/to/your/hdf5/installation`.
4. Retry your `hatch` command.

If are you using an Apple M1 machine and encounter the error `incompatible architecture (have (x86_64), need (arm64e))` while installing the build (for example, while installing `hdbscan`), take the following steps:
1. Run `softwareupdate --install-rosetta` to install Rosetta2 in order to emulate Intel CPUs on your ARM machine.
2. Purge the `pip` cache with `pip cache purge`.
3. Retry `pip install -e .` from the repo base directory.

## Useful Resources
- [Hatch Quickstart](https://hatch.pypa.io/latest/)
- [Hatch CLI Reference](https://hatch.pypa.io/latest/cli/reference/)
