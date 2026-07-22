# This Dockerfile is provided for convenience if you wish to run Phoenix in a
# container or sidecar. To build the image, run the following commmand:
#
# > docker build -t phoenix
#
# You can then run the image in the background with:
#
# > docker run -d --name phoenix -p 6006:6006 phoenix
#
# or in the foreground with:
#
# > docker run -it -p 6006:6006 phoenix
#
# How are you using Phoenix in production? Let us know!
#
# To get support or provide feedback, contact the team in the #phoenix-support
# channel in the Arize AI Slack community or file an issue on GitHub:
#
# - https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g
# - https://github.com/Arize-ai/phoenix/issues

ARG BASE_IMAGE=gcr.io/distroless/python3-debian13:nonroot
# To deploy it on an arm64, like Raspberry Pi or Apple-Silicon, chose this image instead:
# ARG BASE_IMAGE=gcr.io/distroless/python3-debian13:nonroot-arm64

# This Dockerfile is a multi-stage build. The first stage builds the frontend.
FROM node:22-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PHOENIX_ENABLE_SOURCE_MAP=True
WORKDIR /phoenix/app/
COPY ./app /phoenix/app
RUN npm i -g corepack
RUN corepack enable
RUN corepack install
RUN pnpm install
RUN pnpm run build

# The second stage builds the backend.
FROM ghcr.io/astral-sh/uv:0.11.12-python3.13-trixie-slim AS backend-builder
WORKDIR /phoenix
COPY ./src /phoenix/src
COPY ./pyproject.toml /phoenix/
COPY ./uv.lock /phoenix/
COPY ./LICENSE /phoenix/
COPY ./IP_NOTICE /phoenix/
COPY ./README.md /phoenix/
COPY --from=frontend-builder /phoenix/src/phoenix/server/static/ /phoenix/src/phoenix/server/static/
RUN uv sync \
  --no-dev \
  --no-install-project \
  --no-sources \
  --extra container \
  --extra pg
RUN uv build
RUN uv pip install dist/*.whl --no-deps

# Pre-download the CPython WASM binary so the WASM sandbox provider works
# inside the distroless final image without network egress or a writable
# home cache. The URL/filename/sha256 here MUST stay in sync with
# src/phoenix/server/sandbox/_download.py (_WASM_URL / _WASM_FILENAME /
# _WASM_SHA256); the env var PHOENIX_WASM_BINARY_PATH (set in the final
# stage) is the authoritative resolver hook consumed by
# ensure_wasm_binary(). The sha256 assertion guards against upstream
# release-asset tampering — TLS alone is not enough for a binary that
# executes user code in the sandbox. Uses python (already present in
# the uv builder image) instead of curl/wget so we don't add an apt-get
# install layer.
RUN mkdir -p /wasm \
  && python -c "import hashlib, sys, urllib.request; \
url = 'https://github.com/vmware-labs/webassembly-language-runtimes/releases/download/python%2F3.12.0%2B20231211-040d5a6/python-3.12.0.wasm'; \
dest = '/wasm/python-3.12.0.wasm'; \
expected = 'e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763'; \
urllib.request.urlretrieve(url, dest); \
actual = hashlib.sha256(open(dest, 'rb').read()).hexdigest(); \
(actual == expected) or sys.exit(f'SHA-256 mismatch for {dest}: expected {expected}, got {actual}')"

# Bundle the Deno runtime so the local DENO sandbox provider works inside
# the distroless image. denoland/deno:bin-<version> is a scratch-based
# image that contains a single statically-linked /deno binary, which is
# safe to COPY into the distroless final stage without dragging in a
# shell or libc. Pinning the version (NOT :latest) keeps builds
# reproducible.
FROM denoland/deno:bin-2.1.4 AS deno-binary

# The production image is distroless, meaning that it is a minimal image that
# contains only the necessary dependencies to run the application. This is
# useful for security and performance reasons. If you need to debug the
# container, you can build from the debug image instead and run
#
# > docker run --entrypoint=sh -it phoenix
#
# to enter a shell. For more information, see:
#
# https://github.com/GoogleContainerTools/distroless?tab=readme-ov-file#debug-images
#
# Use the debug tag in the following line to build the debug image.
FROM ${BASE_IMAGE}
WORKDIR /phoenix
COPY --from=backend-builder /phoenix/.venv/ ./.venv
# Bundled local sandbox runtimes (Deno + CPython WASM). The Deno binary
# is statically linked, so a single COPY into the distroless image keeps
# the security/footprint properties documented in the comment block
# above. shutil.which("deno") in src/phoenix/server/sandbox/deno_backend.py
# resolves to /usr/local/bin/deno because /usr/local/bin is on the
# distroless image's default PATH (inherited via the base image's ENV).
COPY --chmod=755 --from=deno-binary /deno /usr/local/bin/deno
COPY --from=backend-builder /wasm/python-3.12.0.wasm /opt/phoenix/wasm/python-3.12.0.wasm
ENV PHOENIX_WASM_BINARY_PATH=/opt/phoenix/wasm/python-3.12.0.wasm
# Ensure /usr/local/bin is on PATH so shutil.which("deno") in
# deno_backend.py resolves to the bundled binary above. The base
# distroless image's default PATH already includes /usr/local/bin, but
# we set it explicitly to keep DENO discovery insensitive to base-image
# PATH drift on future bumps.
ENV PATH="/usr/local/bin:/usr/bin:/bin"
ENV PYTHONPATH="/phoenix/.venv/lib/python3.13/site-packages:$PYTHONPATH"
ENV PYTHONUNBUFFERED=1
# Expose the Phoenix port.
EXPOSE 6006
# Expose the Phoenix gRPC port.
EXPOSE 4317
# Expose the Prometheus port.
EXPOSE 9090
# Run the Phoenix server. Note that the ENTRYPOINT of the base image invokes
# Python, so no explicit invocation of Python is needed here. See
# https://github.com/GoogleContainerTools/distroless/blob/16dc4a6a33838006fe956e4c19f049ece9c18a8d/python3/BUILD#L55
CMD ["-m", "phoenix.server.main", "serve"]
