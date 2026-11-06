# Preview image for one factory PR: the PR's Python source and frontend build laid over
# a published Phoenix image, plus the seed script from the PR body and the launcher that
# runs it once the server is up. Built by docker-bake.hcl from factory-preview.yml, never
# by hand.
#
#   STATIC_SOURCE  `base` to keep the base image's frontend build, `frontend` to take the
#                  one in the `frontend` build context
#
# The main build context is the PR's checkout, used only for COPY, so nothing from the PR
# runs on the runner. Named contexts: `base-image`, the Phoenix image to overlay, either the
# published image of the main commit whose dependencies match the PR or the bake target
# that builds the PR in full; `frontend`, the PR's own frontend-builder stage (any image
# when unused); `preview`, this directory from the base branch, for the launcher; and
# `seed`, a directory that holds seed.py.
ARG STATIC_SOURCE=base

# The site-packages path is matched by wildcard so a Python bump in the base image does
# not break the copy.
FROM scratch AS static-base
COPY --from=base-image /phoenix/.venv/lib/python3.*/site-packages/phoenix/server/static/ /static/

FROM scratch AS static-frontend
COPY --from=frontend /phoenix/src/phoenix/server/static/ /static/

FROM static-${STATIC_SOURCE} AS static

FROM base-image
# The overlay shadows the installed package rather than overwriting it: a module the PR
# adds or changes is imported from here first. phoenix/__init__.py extends the package
# path to the installed copy, so a module or subpackage the PR deletes directly under
# phoenix/ stays importable; only a module deleted inside a subpackage the overlay still
# provides is gone. A PR whose point is such a deletion needs a full build to show it.
COPY src/phoenix /phoenix/overlay/phoenix
COPY --from=static /static/ /phoenix/overlay/phoenix/server/static/
COPY --from=preview launch.py seed_log.py /phoenix/preview/
COPY --from=seed seed.py /phoenix/preview/seed.py
ENV PYTHONPATH="/phoenix/overlay:${PYTHONPATH}"
# Phoenix turns auth on when it binds a non-loopback host, as it does here. A preview has
# no users to log in, and its seed talks to it without a key, so it stays open; the access
# gate belongs in front of the hosted instance.
ENV PHOENIX_ENABLE_AUTH=false
# The base image's ENTRYPOINT is the interpreter, so this runs the launcher with it.
CMD ["/phoenix/preview/launch.py"]
