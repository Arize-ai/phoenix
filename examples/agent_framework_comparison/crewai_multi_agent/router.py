import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from calculator import CalculatorTool
from crewai import Agent, Crew, Process, Task
from db.database import get_schema, get_table
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from prompt_templates.router_template import SYSTEM_PROMPT as MANAGER_SYSTEM_PROMPT
from prompt_templates.sql_generator_template import SYSTEM_PROMPT as SQL_SYSTEM_PROMPT
from sql_query import SQLQueryTool

load_dotenv()


def run_crewai(query):
    llm = ChatOpenAI(model="gpt-4o")

    calculator_tool = CalculatorTool()
    sql_query_tool = SQLQueryTool()

    calculator_agent = Agent(
        role="Calculator",
        goal="Perform basic arithmetic operations (+, -, *, /) on two integers.",
        backstory="You are a helpful assistant that can perform basic arithmetic operations (+, -, *, /) "
        "on two integers.",
        tools=[calculator_tool],
        allow_delegation=False,
        verbose=True,
        llm=llm,
    )
    data_analyzer_agent = Agent(
        role="Data Analyzer",
        goal="Provide insights, trends, or analysis based on the data and prompt.",
        backstory="You are a helpful assistant that can provide insights, trends, or analysis based on "
        "the data and prompt.",
        allow_delegation=False,
        verbose=True,
        llm=llm,
    )
    sql_query_agent = Agent(
        role="SQL Query",
        goal="Generate a SQL query based on a user prompt and runs it on the database.",
        backstory=SQL_SYSTEM_PROMPT.format(SCHEMA=get_schema(), TABLE=get_table()),
        tools=[sql_query_tool],
        allow_delegation=False,
        verbose=True,
        llm=llm,
    )

    system_message = (
        "First, identify and make all necessary agent calls based on the user prompt. "
        "Ensure that you gather and aggregate the results from these agent calls. "
        "Once all agent calls are completed and the final result is ready, return it in a single message."
        "If the task is about finding any trends, use the SQL Query Agent first, to retrieve the data "
        "for Data Analyzer Agent."
    )
    manager_agent = Agent(
        role="Manager",
        goal=system_message,
        backstory=MANAGER_SYSTEM_PROMPT,
        allow_delegation=True,
        verbose=True,
        llm=llm,
    )

    user_query_task = Task(
        description=query,
        expected_output="Once all agent calls are completed and the final result is ready, return it "
        "in a single message.",
        agent=manager_agent,
    )

    crew = Crew(
        agents=[calculator_agent, data_analyzer_agent, sql_query_agent],
        tasks=[user_query_task],
        process=Process.sequential,
        manager_agent=manager_agent,
    )
    result = crew.kickoff()
    return result.raw
