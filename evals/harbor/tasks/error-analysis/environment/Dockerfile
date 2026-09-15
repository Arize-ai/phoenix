FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
COPY container_assets/ /opt/phoenix-eval/
COPY data/ /data/
