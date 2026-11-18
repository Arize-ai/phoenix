# Phoenix image publishing

Release and nightly workflows build each platform once and push the same image
and tags to Docker Hub (`arizephoenix/phoenix`) and GHCR
(`ghcr.io/arize-ai/phoenix`). Experimental images continue to use Docker Hub.
Build jobs export OCI image archives as Actions artifacts with a one-day
retention. Docker Hub and GHCR each have independent publishing jobs that copy
those archives with their own credentials, preserving image digests, provenance,
and SBOMs. A denied GHCR upload or a Docker Hub outage fails only that registry's
publishing job; it cannot block uploads to the other. Release deployment updates
depend only on Docker Hub publishing.

The manifest action publishes tags only after every expected platform image is
available and uploaded to its destination. It then checks the published
architectures. OCI artifacts add storage and transfer overhead, but let both
registries reuse the exact same build without using either registry as staging
storage.

GHCR authentication uses the workflow's `GITHUB_TOKEN` with `packages: write`.
After the first publication, a package admin must make the `phoenix` package
public and confirm that `Arize-ai/phoenix` has publishing access under
**Manage Actions access**. If organization policy blocks public packages, an
organization owner must allow them first.
