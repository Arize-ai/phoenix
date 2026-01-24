import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from autogen import (
    AssistantAgent,
    GroupChat,
    GroupChatManager,
    UserProxyAgent,
    register_function,
)
from calculator import calculator
from db.database import get_schema, get_table
from dotenv import load_dotenv
from openinference.semconv.trace import SpanAttributes
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from prompt_templates.router_template import SYSTEM_PROMPT as MANAGER_SYSTEM_PROMPT
from prompt_templates.sql_generator_template import SYSTEM_PROMPT as SQL_SYSTEM_PROMPT
from sql_query import run_sql_query

load_dotenv()


def run_autogen_agents(query, parent_context):
    tracer = trace.get_tracer(__name__)
    propagator = TraceContextTextMapPropagator()
    context = propagator.extract(parent_context)

    with tracer.start_as_current_span("agents_call", context=context) as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "CHAIN")
        span.set_attribute(SpanAttributes.INPUT_VALUE, str(query))
        span.set_attribute(SpanAttributes.INPUT_MIME_TYPE, "application/json")
        span.set_attribute(SpanAttributes.LLM_TOOLS, str(["calculator", "run_sql_query"]))

        config_list = [{"model": "gpt-4o", "api_key": os.environ["OPENAI_API_KEY"]}]
        llm_config = {"config_list": config_list, "cache_seed": 42}

        calculator_agent = AssistantAgent(
            name="Calculator",
            description="Perform basic arithmetic operations (+, -, *, /) on two integers.",
            system_message="You are a helpful assistant that can perform basic arithmetic operations "
            "(+, -, *, /) on two integers.",
            llm_config=llm_config,
        )
        data_analyzer_agent = AssistantAgent(
            name="Data_Analyzer",
            description="Provide insights, trends, or analysis based on the data and prompt.",
            system_message="You are a helpful assistant that can provide insights, trends, or analysis "
            "based on the data and prompt.",
            llm_config=llm_config,
        )
        sql_query_agent = AssistantAgent(
            name="SQL_Query",
            description="Generate a SQL query based on a user prompt and runs it on the database.",
            system_message=SQL_SYSTEM_PROMPT.format(SCHEMA=get_schema(), TABLE=get_table()),
            llm_config=llm_config,
        )

        system_message = (
            MANAGER_SYSTEM_PROMPT
            + "First, identify and make all necessary agent calls based on the user prompt. "
            + "Ensure that you gather and aggregate the results from these agent calls. "
            + "Once all agent calls are completed and the final result is ready, return it in a single message. "
            + "When the task is fully completed, ensure the final message contains the full result, "
            "followed by 'TERMINATE' at the very end."
            + "If the task is about finding any trends, use the SQL_Query Agent first, "
            "to retrieve the data for Data_Analyzer Agent."
        )
        manager_agent = AssistantAgent(
            name="Manager",
            system_message=system_message,
            llm_config=llm_config,
        )
        user_proxy_agent = UserProxyAgent(
            name="User_Proxy",
            is_termination_msg=lambda msg: msg.get("content") is not None
            and "TERMINATE" in msg["content"],
            human_input_mode="NEVER",
            max_consecutive_auto_reply=10,
            code_execution_config={
                "last_n_messages": 10,
                "work_dir": "groupchat",
                "use_docker": True,
            },
        )

        register_function(
            calculator,
            caller=calculator_agent,
            executor=user_proxy_agent,
            name="Calculator_Tool",
            description="A tool that can be used to perform basic arithmetic operations "
            "(+, -, *, /) on two integers.",
        )
        register_function(
            run_sql_query,
            caller=sql_query_agent,
            executor=user_proxy_agent,
            name="SQL_Query_Executor_Tool",
            description="A tool that can be used to run SQL query on the database.",
        )

        agents = [
            calculator_agent,
            data_analyzer_agent,
            sql_query_agent,
            manager_agent,
            user_proxy_agent,
        ]
        groupchat = GroupChat(agents=agents, messages=[], max_round=15)
        groupchat_manager = GroupChatManager(groupchat=groupchat, llm_config=llm_config)

        result = user_proxy_agent.initiate_chat(
            groupchat_manager,
            message=query,
        )
        last_chat_message = result.chat_history[-1]["content"]

        span.set_attribute(SpanAttributes.OUTPUT_VALUE, str(last_chat_message))
        return last_chat_message
