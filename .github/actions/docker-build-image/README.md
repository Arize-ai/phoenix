# Phoenix image publishing

Release and nightly workflows build each platform once and push the same image
and tags to Docker Hub (`arizephoenix/phoenix`) and GHCR
(`ghcr.io/arize-ai/phoenix`). Experimental images continue to use Docker Hub.
The manifest action publishes tags only after all platform digests are present,
and checks the published architectures in both registries.

GHCR authentication uses the workflow's `GITHUB_TOKEN` with `packages: write`.
After the first publication, a package admin must make the `phoenix` package
public and confirm that `Arize-ai/phoenix` has publishing access under
**Manage Actions access**. If organization policy blocks public packages, an
organization owner must allow them first.

Run `make test-docker-publish` to check publishing orchestration. These checks
stub registry calls; verifying a real push still requires an Actions run.
