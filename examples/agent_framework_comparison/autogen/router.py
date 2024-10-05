import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], '..'))

from autogen import AssistantAgent, UserProxyAgent, register_function
from dotenv import load_dotenv

from skills.analyze_data_func import data_analyzer
from skills.generate_sql_query_func import generate_and_run_sql_query

from prompt_templates.router_template import AUTOGEN_ROUTER_SYSTEM_PROMPT
from db.database import get_table

load_dotenv()


def run_autogen_agents(query):
    config_list = [
        {
            "model": "gpt-4o",
            "api_key": os.environ["OPENAI_API_KEY"]
        }
    ]

    assistant = AssistantAgent(
        name="Assistant",
        system_message=AUTOGEN_ROUTER_SYSTEM_PROMPT,
        llm_config={"config_list": config_list},
    )

    user_proxy = UserProxyAgent(
        name="User",
        is_termination_msg=lambda msg: msg.get("content") is not None and "TERMINATE" in msg["content"],
        human_input_mode="NEVER",
        max_consecutive_auto_reply=10,
    )

    tools = [
        {
            "function": data_analyzer,
            "description": "Provides insights, trends, or analysis based on the data and the original prompt."
        },
        {
            "function": generate_and_run_sql_query,
            "description": (
                f"Generates and runs an SQL query based on the original prompt. "
                f"Has access to a table called {get_table()}."
            )
        },
    ]
    for tool in tools:
        register_function(
            tool['function'],
            caller=assistant,
            executor=user_proxy,
            description=tool['description']
        )

    result = user_proxy.initiate_chat(
        assistant,
        message=query,
    )
    last_chat_message = result.chat_history[-1]['content']
    return last_chat_message
