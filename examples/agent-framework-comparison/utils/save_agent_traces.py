import phoenix as px
import os

# This function saves traces of the agent in the project to a local directory.
# This is used primarily to create example sets of traces for each agent.
# Likely not needed for most users.
def save_agent_traces(project_name: str):
    directory = 'utils/saved_traces'
    os.makedirs(directory, exist_ok=True)

    # Save the Trace Dataset
    px.Client().get_trace_dataset(project_name=project_name).save(directory=directory)
    
if __name__ == "__main__":
    save_agent_traces(project_name="function-calling-agent-demo")