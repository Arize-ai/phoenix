# Phoenix server under test, with the TRAIL seed already loaded into /data.
# Build context (staged by scripts/build_images.sh):
#   wheels/arize_phoenix-*.whl   server wheel built from the checkout under test
#   seed/trail-gaia.json         TRAIL rows downloaded by scripts/download_trail.py
#   seed/load_patronus_trail.py  repository loader script
#   seed/seed.py                 runs the loader against a throwaway server
FROM python:3.13-slim-bookworm AS base
COPY wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl
ENV PHOENIX_WORKING_DIR=/data \
    PHOENIX_TELEMETRY_ENABLED=false \
    PHOENIX_DISABLE_AGENT_ASSISTANT=true

# Seed in a throwaway stage so the raw TRAIL rows stay out of the final image.
FROM base AS seeded
ARG SEED_PROJECT=research-assistant
ENV SEED_PROJECT=${SEED_PROJECT}
COPY seed/ /seed/
RUN python /seed/seed.py

FROM base
COPY --from=seeded /data /data
COPY --from=seeded /seed/summary.json /seed/summary.json
EXPOSE 6006
CMD ["phoenix", "serve", "--no-ui"]
