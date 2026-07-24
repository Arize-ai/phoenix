FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl asgi-lifespan
COPY run_server_agent.py bootstrap_data.sh /opt/phoenix-eval/
