import asyncio

from agents import Agent, Runner
from agents.mcp import MCPServer, MCPServerStdio
from dotenv import load_dotenv

from phoenix.otel import register

load_dotenv()

tracer_provider = register(auto_instrument=True, endpoint="http://localhost:6006/v1/traces")


async def run(mcp_server: MCPServer):
    agent = Agent(
        name="Assistant",
        instructions="Use the tools to answer the users question.",
        mcp_servers=[mcp_server],
    )
    while True:
        message = input("\n\nEnter your question (or 'exit' to quit): ")
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
            "args": ["run", "./tutorials/mcp/tracing_between_mcp_client_and_server/server.py"],
        },
        client_session_timeout_seconds=30,
    ) as server:
        await run(server)


if __name__ == "__main__":
    asyncio.run(main())
