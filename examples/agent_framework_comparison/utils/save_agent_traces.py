import os

import phoenix as px


# This function saves traces of the agent in the project to a local directory.
# This is used primarily to create example sets of traces for each agent.
# Likely not needed for most users.
def save_agent_traces(project_name: str):
    directory = "examples/agent_framework_comparison/utils/saved_traces"
    os.makedirs(directory, exist_ok=True)

    # Save the Trace Dataset
    traces = px.Client().get_trace_dataset(project_name=project_name)
    traces.save(directory=directory)


if __name__ == "__main__":
    save_agent_traces(project_name="agent-demo")
