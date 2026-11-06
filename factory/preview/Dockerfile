# One factory PR's preview: its Python source and frontend laid over a published Phoenix
# image, with the seed script from its body and the launcher that runs it. Built only by
# docker-bake.hcl, which supplies the contexts: `base-image` (the image to overlay),
# `frontend` (the PR's frontend-builder stage, when STATIC_SOURCE is `frontend`),
# `preview` (this directory, from the base branch) and `seed` (holds seed.py). The main
# context is the PR's checkout and is only ever copied from.
ARG STATIC_SOURCE=base

# Wildcarded so a Python bump in the base image does not break the copy.
FROM scratch AS static-base
COPY --from=base-image /phoenix/.venv/lib/python3.*/site-packages/phoenix/server/static/ /static/

FROM scratch AS static-frontend
COPY --from=frontend /phoenix/src/phoenix/server/static/ /static/

FROM static-${STATIC_SOURCE} AS static

FROM base-image
# Shadows the installed package. phoenix/__init__.py extends the package path to the
# installed copy, so a module the PR deletes directly under phoenix/ stays importable.
COPY src/phoenix /phoenix/overlay/phoenix
COPY --from=static /static/ /phoenix/overlay/phoenix/server/static/
COPY --from=preview launch.py seed_log.py /phoenix/preview/
COPY --from=seed seed.py /phoenix/preview/seed.py
ENV PYTHONPATH="/phoenix/overlay:${PYTHONPATH}"
# Auth defaults on for a non-loopback bind; a preview has no users and its seed has no key.
ENV PHOENIX_ENABLE_AUTH=false
# The base image's ENTRYPOINT is the interpreter, so this runs the launcher with it.
CMD ["/phoenix/preview/launch.py"]
