import asyncio

from dotenv import load_dotenv

# 1. Load environment variables
load_dotenv()

from phoenix.otel import register

# Connect to your Arize instance
tracer_provider = register(project_name="test_mcp_project")

# 2. Set up instrumentation BEFORE any imports that use MCP
from openinference.instrumentation.mcp import MCPInstrumentor
from openinference.instrumentation.openai_agents import OpenAIAgentsInstrumentor

# Apply instrumentation before any MCP imports
MCPInstrumentor().instrument(tracer_provider=tracer_provider)
OpenAIAgentsInstrumentor().instrument(tracer_provider=tracer_provider)

# 3. Only NOW import modules that use MCP
from agents import Agent, Runner
from agents.mcp import MCPServer, MCPServerStdio


async def run(mcp_server: MCPServer):
    agent = Agent(
        instructions="Use the tools to answer the users question.",
        name="Assistant",
        mcp_servers=[mcp_server],
    )
    while True:
        message = input("\n\nEnter your question (or 'exit' to quit or blank for default): ")
        if not message:
            message = "What is the effect of tariffs on canada"
        if message.lower() == "exit" or message.lower() == "q":
            break
        print(f"\n\nRunning: {message}")
        result = await Runner.run(starting_agent=agent, input=message)
        print(result.final_output)


async def main():
    async with MCPServerStdio(
        name="Financial Analysis Server",
        params={
            "command": "fastmcp",
            "args": ["run", "./server.py"],
        },
        client_session_timeout_seconds=30,
    ) as server:
        await run(server)


if __name__ == "__main__":
    asyncio.run(main())
