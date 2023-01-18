# Arize Phoenix

## About

Phoenix provides MLOps insights at lightning speed with zero-config observability for model drift, performance, and data quality.

***Phoenix is under active development. APIs may change at any time.***

## Installation

```shell
pip install arize-phoenix
```

### Troubleshooting

If are you using an Apple silicon machine and encounter the error `incompatible architecture (have (x86_64), need (arm64e))` during installation, take the following steps:
1. Run `softwareupdate --install-rosetta` to install Rosetta2.
2. Purge the `pip` cache with `pip cache purge`.
3. Re-run `pip install arize-phoenix`.
