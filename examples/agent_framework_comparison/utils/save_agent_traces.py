# type: ignore
import os

from phoenix.client import Client


# This function saves traces of the agent in the project to a local directory.
# This is used primarily to create example sets of traces for each agent.
# Likely not needed for most users.
def save_agent_traces(project_name: str):
    directory = "examples/agent_framework_comparison/utils/saved_traces"
    os.makedirs(directory, exist_ok=True)

    # Save the trace DataFrame
    client = Client()
    df = client.spans.get_spans_dataframe(project_name=project_name)
    df.to_parquet(os.path.join(directory, f"{project_name}.parquet"))


if __name__ == "__main__":
    save_agent_traces(project_name="agent-demo")
