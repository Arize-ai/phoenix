FROM python:3.11-slim
COPY wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl asgi-lifespan
COPY run_server_agent.py bootstrap_data.sh /opt/phoenix-eval/
