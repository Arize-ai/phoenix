ARG STATIC_SOURCE=base

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
CMD ["/phoenix/preview/launch.py"]
