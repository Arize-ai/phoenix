FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl asgi-lifespan
COPY run_headless_agent.py fetch_fixtures.py start_phoenix_server.sh /opt/phoenix-eval/
