"""Observe Your Agent: send a first trace to Phoenix."""

# docs:start register
from phoenix.otel import register

register(project_name="tracing-quickstart", protocol="http/protobuf", auto_instrument=True)
# docs:end register

# docs:start call
from openai import OpenAI

client = OpenAI()
client.chat.completions.create(
    model="gpt-5-mini",
    messages=[{"role": "user", "content": "Why did my invoice change?"}],
)
# docs:end call
