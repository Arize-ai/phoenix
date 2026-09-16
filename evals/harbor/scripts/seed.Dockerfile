# Throwaway image that seeds the tool benchmark database from the TRAIL rows.
# scripts/seed_phoenix_tools.sh builds it, copies /data/phoenix.db out, and never
# ships it: the raw rows must stay on the developer's machine.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
ENV PHOENIX_WORKING_DIR=/data \
    PHOENIX_TELEMETRY_ENABLED=false \
    PHOENIX_DISABLE_AGENT_ASSISTANT=true
ARG SEED_PROJECT=research-assistant
ENV SEED_PROJECT=${SEED_PROJECT}
COPY seed/ /seed/
RUN python /seed/seed.py
