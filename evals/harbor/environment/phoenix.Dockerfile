# Build Phoenix from the checkout and seed /data. The throwaway seed stage
# keeps the raw TRAIL rows out of the final image.
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
