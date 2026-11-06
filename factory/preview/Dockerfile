# Preview image for one factory PR: the PR's Python source and frontend build laid over
# a published Phoenix image, plus the seed script from the PR body and the launcher that
# runs it once the server is up. Built by factory-preview.yml, never by hand.
#
#   BASE_IMAGE     the Phoenix image to overlay: the published image of the main commit
#                  whose dependencies match the PR, or a full build of the PR when none does
#   STATIC_SOURCE  `base` to keep the base image's frontend build, `frontend` to take the
#                  one in the `frontend` build context, which the workflow builds from the
#                  PR's own Dockerfile stage so the two never drift apart
#
# The build context is the PR's checkout, used only for COPY, so nothing from the PR runs
# on the runner. Other build contexts: `preview`, this directory from the base branch, for
# the launcher; `seed`, a directory that holds seed.py; and `frontend`, an image whose
# /phoenix/src/phoenix/server/static is the PR's frontend build (any image when unused).
ARG BASE_IMAGE
ARG STATIC_SOURCE=base

# The site-packages path is matched by wildcard so a Python bump in the base image does
# not break the copy.
FROM scratch AS static-base
COPY --from=base-image /phoenix/.venv/lib/python3.*/site-packages/phoenix/server/static/ /static/

FROM scratch AS static-frontend
COPY --from=frontend /phoenix/src/phoenix/server/static/ /static/

FROM static-${STATIC_SOURCE} AS static

FROM ${BASE_IMAGE}
# The overlay shadows the installed package rather than overwriting it, so files the PR
# deletes disappear too. The base image's PYTHONPATH keeps dependencies resolvable.
COPY src/phoenix /phoenix/overlay/phoenix
COPY --from=static /static/ /phoenix/overlay/phoenix/server/static/
COPY --from=preview launch.py /phoenix/preview/launch.py
COPY --from=seed seed.py /phoenix/preview/seed.py
ENV PYTHONPATH="/phoenix/overlay:${PYTHONPATH}"
# Phoenix turns auth on when it binds a non-loopback host, as it does here. A preview has
# no users to log in, and its seed talks to it without a key, so it stays open; the access
# gate belongs in front of the hosted instance.
ENV PHOENIX_ENABLE_AUTH=false
# The base image's ENTRYPOINT is the interpreter, so this runs the launcher with it.
CMD ["/phoenix/preview/launch.py"]
