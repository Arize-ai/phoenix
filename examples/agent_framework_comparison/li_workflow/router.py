import os
import sys

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from dotenv import load_dotenv
from llama_index.core.llms import ChatMessage
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.tools import FunctionTool, ToolMetadata, ToolSelection
from llama_index.core.workflow import Event, StartEvent, StopEvent, Workflow, step
from openinference.instrumentation import using_prompt_template
from prompt_templates.router_template import SYSTEM_PROMPT

from skills.skill_map import SkillMap

load_dotenv()

skill_map = SkillMap()


class ToolCallEvent(Event):
    tool_calls: list[ToolSelection]


class RouterInputEvent(Event):
    input: list[ChatMessage]


class AgentFlow(Workflow):
    def __init__(self, llm, timeout=300):
        super().__init__(timeout=timeout)
        self.llm = llm
        self.memory = ChatMemoryBuffer(token_limit=1000).from_defaults(llm=llm)
        self.tools = []
        for func in skill_map.get_function_list():
            self.tools.append(
                FunctionTool(
                    skill_map.get_function_callable_by_name(func),
                    metadata=ToolMetadata(
                        name=func, description=skill_map.get_function_description_by_name(func)
                    ),
                )
            )

    @step
    async def prepare_agent(self, ev: StartEvent) -> RouterInputEvent:
        user_input = ev.input
        user_msg = ChatMessage(role="user", content=user_input)
        self.memory.put(user_msg)

        chat_history = self.memory.get()
        return RouterInputEvent(input=chat_history)

    @step
    async def router(self, ev: RouterInputEvent) -> ToolCallEvent | StopEvent:
        messages = ev.input

        if not any(
            isinstance(message, dict) and message.get("role") == "system" for message in messages
        ):
            system_prompt = ChatMessage(role="system", content=SYSTEM_PROMPT)
            messages.insert(0, system_prompt)

        with using_prompt_template(template=SYSTEM_PROMPT, version="v0.1"):
            response = await self.llm.achat_with_tools(
                model="gpt-4o",
                messages=messages,
                tools=self.tools,
            )

        self.memory.put(response.message)

        tool_calls = self.llm.get_tool_calls_from_response(response, error_on_no_tool_call=False)
        if tool_calls:
            return ToolCallEvent(tool_calls=tool_calls)
        else:
            return StopEvent(result=response.message.content)

    @step
    async def tool_call_handler(self, ev: ToolCallEvent) -> RouterInputEvent:
        tool_calls = ev.tool_calls

        for tool_call in tool_calls:
            function_name = tool_call.tool_name
            arguments = tool_call.tool_kwargs
            if "input" in arguments:
                arguments["prompt"] = arguments.pop("input")

            try:
                function_callable = skill_map.get_function_callable_by_name(function_name)
            except KeyError:
                function_result = "Error: Unknown function call"

            function_result = function_callable(arguments)
            message = ChatMessage(
                role="tool",
                content=function_result,
                additional_kwargs={"tool_call_id": tool_call.tool_id},
            )

            self.memory.put(message)

        return RouterInputEvent(input=self.memory.get())
