import os
from getpass import getpass
from dotenv import load_dotenv

from smolagents import CodeAgent, HfApiModel, tool
from phoenix.otel import register

# Load environment variables from .env file
load_dotenv()

# Set up Hugging Face Token
if not (hf_token := os.getenv("HF_TOKEN")):
    hf_token = getpass("🔑 Enter your Hugging Face Token: ")
os.environ["HF_TOKEN"] = hf_token

# Retrieve Phoenix endpoint and API key from environment
phoenix_endpoint = os.getenv("PHOENIX_ENDPOINT")
phoenix_api_key = os.getenv("PHOENIX_API_KEY")

if not phoenix_endpoint:
    phoenix_endpoint = getpass("Enter your Phoenix endpoint ")
if not phoenix_api_key:
    phoenix_api_key = getpass("Enter your Phoenix API key: ")

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = phoenix_endpoint
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={phoenix_api_key}"

# Register Phoenix tracing with auto-instrumentation for SmolAgents
tracer_provider = register(
    project_name="smolagents-streaming-bug-demo",
    endpoint="https://app.phoenix.arize.com/v1/traces",
    protocol="http/protobuf",
    auto_instrument=True,
)

# Define a simple tool
@tool
def extract_keywords(text: str) -> str:
    """
    Extracts keywords from the input text.

    Args:
        text: The resume text to extract keywords from.

    Returns:
        A comma-separated string of keywords with more than 5 letters.
    """
    words = text.split()
    keywords = [word.strip(".,") for word in words if len(word) > 5]
    return ", ".join(keywords)

# Create the agent
model = HfApiModel()
agent = CodeAgent(tools=[extract_keywords], model=model)

# Run the agent with streaming enabled (this triggers the bug)
prompt = (
    "Extract keywords from this resume: 'Experienced software engineer with 5+ years in Python, "
    "React, and cloud technologies. Led development of microservices architecture and implemented "
    "CI/CD pipelines. Strong background in machine learning and data analysis.' "
    "Then summarize what these keywords suggest about the candidate's technical expertise."
)

print("Running agent with stream=True (this will show the tracing bug)...")
for chunk in agent.run(prompt, stream=True):
    print(chunk, end="", flush=True)

print("\nDone. Check Phoenix traces: each step will be its own trace/span instead of being grouped.")
# See https://github.com/Arize-ai/openinference/issues/1322 for details on the bug. 