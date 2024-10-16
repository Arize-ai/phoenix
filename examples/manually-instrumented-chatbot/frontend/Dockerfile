FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt /app/
RUN pip install uv
RUN uv venv
ENV PATH="/app/.venv/bin:$PATH"
RUN uv pip sync requirements.txt

FROM gcr.io/distroless/python3-debian12
WORKDIR /app
COPY --from=builder /app/.venv/lib/python3.11/site-packages/ /app/site-packages/
ENV PYTHONPATH="/app/site-packages:$PYTHONPATH"
COPY src/ /app/src/
EXPOSE 8501
CMD ["-m", "streamlit", "run", "src/app.py", "--server.port=8501", "--server.address=0.0.0.0"]
