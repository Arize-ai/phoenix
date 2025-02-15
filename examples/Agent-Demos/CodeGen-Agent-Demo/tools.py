import io
import sys

from langchain.agents import tool
from langchain_core.messages import HumanMessage
from langchain_core.runnables.config import RunnableConfig
from langchain_openai import ChatOpenAI


def initialize_tool_llm(model, api_key):
    tool_model = ChatOpenAI(model=model, api_key=api_key, temperature=0.7)
    return tool_model


def llm_call(prompt, config):
    tool_model_agent = config["configurable"]["tool_model"]
    response = tool_model_agent.invoke([HumanMessage(content=prompt)])
    return response.content


@tool
def code_analysis(code: str, *, config: RunnableConfig) -> str:
    """
    Analyzes a given code snippet and provides a human-readable explanation of what the code does.

    Args:
        code (str): The code to analyze.

    Returns:
        str: A plain-text explanation of the code's functionality.
    """
    detailed_prompt = (
        "You are an expert Python developer. Explain what the following code does in detail, "
        "including a breakdown of its functionality, components, and any important details:\n\n"
        f"{code.strip()}\n\n"
        "Provide a detailed explanation of the code's behavior without skipping any important details."
    )

    try:
        return llm_call(detailed_prompt, config)
    except Exception as e:
        return f"Error during analysis: {str(e)}"


@tool
def generate_code(prompt: str, *, config: RunnableConfig) -> str:
    """
    A tool to generate Python code based on user-provided prompts.

    Args:
        prompt (str): A description of the task for which code is to be generated.

    Returns:
        str: The generated Python code.
    """
    try:
        detailed_prompt = f"""
        You’re an expert Python programmer with extensive experience in writing clean, efficient, and executable code. Your specialty is creating simple programs that are easy to understand and execute, while also ensuring they include necessary function calls for validation.

        Your task is to {prompt}\n\n. The program should be executable and should include a function call to validate the code without any additional text before or after the code.
        Please provide the code below:
        """
        response = llm_call(detailed_prompt, config)
        return response.lstrip("```python").rstrip("```")
    except Exception as e:
        return f"Code generation failed: {str(e)}"


@tool
def execute_code(code: str) -> str:
    """
    A tool to execute Python code and return the result or any errors.

    Args:
        code (str): The Python code to be executed.

    Returns:
        str: The output of the code execution or an error message.
    """
    # Redirect stdout to capture the output
    original_stdout = sys.stdout
    output = io.StringIO()
    sys.stdout = output

    try:
        exec_globals = {}
        exec(code, exec_globals)
        result = output.getvalue()
    except Exception as e:
        result = f"Error during execution: {str(e)}"
    finally:
        sys.stdout = original_stdout
        output.close()
    return result


@tool
def generate_merge_request_description(code: str, *, config: RunnableConfig) -> str:
    """
    Generate a detailed merge request description based on the input Python code.

    Args:
        code (str): The Python code for which the merge request description should be generated.

    Returns:
        str: A well-structured merge request description summarizing the purpose, implementation details,
             and additional context for the provided code.
    """
    # Define the prompt for generating a merge request description
    prompt = (
        "You are an AI assistant tasked with generating professional and detailed merge request descriptions. "
        "Based on the provided Python code, create a description that includes the following sections:\n\n"
        "1. **Title**: A concise and clear title for the merge request.\n"
        "2. **Purpose**: Explain the purpose of the code and the problem it solves.\n"
        "3. **Implementation Details**: Describe how the solution is implemented, including key functions, logic, and structure.\n"
        "4. **Testing and Validation**: Mention any tests or validation performed and how the functionality has been verified.\n"
        "5. **Additional Notes**: Provide any additional context, such as future improvements or edge cases handled.\n\n"
        "Here is the Python code:\n\n"
        f"{code.strip()}\n\n"
        "Generate the merge request description in markdown format."
    )
    try:
        response = llm_call(prompt, config)
        return response
    except Exception as e:
        return f"Merge Request Description generation failed: {str(e)}"
