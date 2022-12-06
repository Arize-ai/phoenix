# phoenix.ai

<div align="center">

| | |
| --- | --- |
| CI/CD | [![Python CI](https://github.com/Arize-ai/phoenix/actions/workflows/python-CI.yml/badge.svg)](https://github.com/Arize-ai/phoenix/actions/workflows/python-CI.yml)  [![CD - Build Phoenix]()]() [![CD - Release]()]() |
| Docs | [![Docs - Release]()]() [![Contributor Covenant/Code of Conduct]()]() |
| Package | [![PyPI - Version]()]() [![PyPI - Downloads]()]() [![PyPI - Python Version]()]() |
| Meta | [![Hatch project](https://img.shields.io/badge/%F0%9F%A5%9A-Hatch-4051b5.svg)](https://github.com/pypa/hatch) [![code style - black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black) [![imports - isort](https://img.shields.io/badge/imports-isort-ef8336.svg)](https://github.com/pycqa/isort) [![types - Mypy](https://img.shields.io/badge/types-Mypy-blue.svg)](https://github.com/python/mypy)  [![License - None]()](https://spdx.org/licenses/)|

</div>

Phoenix enables you to get to MLOps insights at lightning speed. Phoenix focuses on surfacing areas
that require critical attention and offers zero-config observability for model drift, performance,
and data quality.

**_ NOTE: Phoenix is under active development. APIs may change at any time _**

## Getting started

```shell
pip install phoenix
```

### Troubleshooting

If you are using an Apple M1 machine and encounter the error `Could not find a local HDF5 installation`, take the following steps:
1. Install HDF5 with `arch -arm64 brew install hdf5`.
2. Find the path to your HDF5 installation with `brew info hdf5`.
3. Set an environment variable with `export HDF5_DIR=/path/to/your/hdf5/installation`.
4. Retry the command you ran when you encountered the error.

If are you using an Apple M1 machine and encounter the error `incompatible architecture (have (x86_64), need (arm64e))` during installation (for example, while installing `hdbscan`), take the following steps:
1. Run `softwareupdate --install-rosetta` to install Rosetta2 in order to emulate Intel CPUs on your ARM machine.
2. Purge the `pip` cache with `pip cache purge`.
3. Retry `pip install -e .` from the repo base directory.

## Unstructured data

Phoenix takes advantage of UMAP and HDBSCAN to highlight segments of your data that are areas of
critical drift.

## Structured / tabular data

Phoenix surfaces up problematic features of your model with regards to drift, performance, and data
quality.
