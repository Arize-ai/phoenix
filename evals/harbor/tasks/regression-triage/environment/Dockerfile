FROM python:3.11-slim
COPY wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl asgi-lifespan
COPY seed_db.py run_server_agent.py /opt/phoenix-eval/
RUN mkdir -p /data && python /opt/phoenix-eval/seed_db.py --db-path /data/phoenix.db --ground-truth-out /data/ground_truth.json
