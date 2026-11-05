# Preview image for one factory PR: the PR's Python source and frontend build laid over
# a published Phoenix image, plus the seed script from the PR body and the launcher that
# runs it once the server is up. Built by factory-preview.yml, never by hand.
#
#   BASE_IMAGE     the Phoenix image to overlay: the published image of the main commit
#                  whose dependencies match the PR, or a full build of the PR when none does
#   STATIC_SOURCE  `base` to keep the base image's frontend build, `build` to build the
#                  PR's frontend here, in a stage that mirrors the main Dockerfile's
#
# The build context is the PR's checkout. Everything from the PR runs inside BuildKit,
# never on the runner, so the frontend's install scripts can't touch the workflow's files
# or credentials. Other build contexts: `preview`, this directory from the base branch, for
# the launcher, and `seed`, a directory that holds seed.py.
ARG BASE_IMAGE
ARG STATIC_SOURCE=base

FROM node:24-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /phoenix/js/
COPY ./js /phoenix/js
COPY ./schemas /phoenix/schemas
RUN npm i -g corepack
RUN corepack enable
RUN corepack install
RUN pnpm install
RUN pnpm --filter 'phoenix-ui...' run build

FROM scratch AS static-build
COPY --from=frontend-builder /phoenix/src/phoenix/server/static /phoenix/.venv/lib/python3.13/site-packages/phoenix/server/static

FROM ${BASE_IMAGE} AS static-base

FROM static-${STATIC_SOURCE} AS static

FROM ${BASE_IMAGE}
# The overlay shadows the installed package rather than overwriting it, so files the PR
# deletes disappear too. The base image's PYTHONPATH keeps dependencies resolvable.
COPY src/phoenix /phoenix/overlay/phoenix
COPY --from=static /phoenix/.venv/lib/python3.13/site-packages/phoenix/server/static /phoenix/overlay/phoenix/server/static
COPY --from=preview launch.py /phoenix/preview/launch.py
COPY --from=seed seed.py /phoenix/preview/seed.py
ENV PYTHONPATH="/phoenix/overlay:${PYTHONPATH}"
# Phoenix turns auth on when it binds a non-loopback host, as it does here. A preview has
# no users to log in, and its seed talks to it without a key, so it stays open; the access
# gate belongs in front of the hosted instance.
ENV PHOENIX_ENABLE_AUTH=false
# The base image's ENTRYPOINT is the interpreter, so this runs the launcher with it.
CMD ["/phoenix/preview/launch.py"]
