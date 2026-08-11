# arize-phoenix-harbor

`arize-phoenix-harbor` is the Phoenix-owned integration package for recording
[Harbor](https://github.com/harbor-framework/harbor) evaluation jobs in Arize Phoenix.

The package is a pre-alpha scaffold. Harbor can discover the `phoenix` plugin, but trying
to run a job with it fails immediately because lifecycle orchestration is not implemented yet.

## Development

Run the package's focused verification gate from the Phoenix repository root:

```bash
tox run -e phoenix_harbor
```
