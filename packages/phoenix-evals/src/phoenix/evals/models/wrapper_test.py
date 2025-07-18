"""
Simple test/example for the Universal LLM Wrapper with LangChain models.

This demonstrates how the wrapper feels to use with LangChain models.

INSTALLATION:
Before running this script, install the required dependencies:

    pip install -r src/phoenix/evals/models/wrapper_requirements.txt

Or install manually:
    pip install langchain>=0.1.0 langchain-anthropic>=0.1.0 anthropic>=0.18.0

ENVIRONMENT:
You'll also need to set your Anthropic API key:
    export ANTHROPIC_API_KEY="your-api-key-here"

USAGE:
    python src/phoenix/evals/models/wrapper_test.py
"""

import asyncio
from typing import Dict, Any

from phoenix.evals.models.wrapper import UniversalLLMWrapper, wrap_langchain_model


def test_basic_langchain_usage():
    """Test basic usage with a LangChain model."""
    print("=== Testing Basic LangChain Usage ===")

    try:
        from langchain_anthropic import ChatAnthropic

        # Create a LangChain model
        langchain_model = ChatAnthropic(model="claude-3-haiku-20240307", temperature=0)

        # Wrap it with our universal wrapper
        wrapper = UniversalLLMWrapper(client=langchain_model)

        print(f"Model name: {wrapper._model_name}")
        print(f"Supports tools: {wrapper.supports_tools}")

        # Test basic text generation
        response = wrapper.generate_text(
            prompt="What is the capital of France?",
            instruction="Be concise"
        )
        print(f"Basic response: {response}")

        # Test using the Phoenix BaseModel interface (backward compatibility)
        phoenix_response = wrapper("Explain quantum computing in one sentence.")
        print(f"Phoenix interface response: {phoenix_response}")

        return True

    except ImportError:
        print("LangChain Anthropic not installed - skipping test")
        return False


def test_tool_calling():
    """Test tool calling with LangChain models."""
    print("\n=== Testing Tool Calling ===")

    try:
        from langchain_anthropic import ChatAnthropic

        # Create a LangChain model
        langchain_model = ChatAnthropic(model="claude-3-haiku-20240307", temperature=0)
        wrapper = UniversalLLMWrapper(client=langchain_model)

        # Define some tools
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the current weather in a location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The city and state, e.g. San Francisco, CA"
                            }
                        },
                        "required": ["location"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "calculate",
                    "description": "Perform a mathematical calculation",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {
                                "type": "string",
                                "description": "The mathematical expression to evaluate"
                            }
                        },
                        "required": ["expression"]
                    }
                }
            }
        ]

        # Test tool calling
        response = wrapper.generate_with_tools(
            prompt="What's the weather like in San Francisco and what's 15 * 23?",
            tools=tools
        )

        print(f"Response type: {response.output_type}")
        print(f"Text content: {response.text}")

        if response.tool_calls:
            print("Tool calls made:")
            for tool_call in response.tool_calls:
                print(f"  - {tool_call.name}: {tool_call.arguments}")
        else:
            print("No tool calls made")

        return True

    except ImportError:
        print("LangChain Anthropic not installed - skipping tool test")
        return False
    except Exception as e:
        print(f"Tool calling test failed: {e}")
        return False


async def test_async_usage():
    """Test async usage."""
    print("\n=== Testing Async Usage ===")

    try:
        from langchain_anthropic import ChatAnthropic

        # Create a LangChain model
        langchain_model = ChatAnthropic(model="claude-3-haiku-20240307", temperature=0)
        wrapper = UniversalLLMWrapper(client=langchain_model)

        # Test async text generation
        response = await wrapper.agenerate_text(
            prompt="Explain machine learning in simple terms",
            instruction="Keep it under 50 words"
        )
        print(f"Async response: {response}")

        # Test async tool calling
        tools = [{
            "type": "function",
            "function": {
                "name": "search",
                "description": "Search for information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"}
                    },
                    "required": ["query"]
                }
            }
        }]

        tool_response = await wrapper.agenerate_with_tools(
            prompt="Search for recent AI developments",
            tools=tools
        )

        print(f"Async tool response type: {tool_response.output_type}")
        if tool_response.tool_calls:
            print("Async tool calls:")
            for tool_call in tool_response.tool_calls:
                print(f"  - {tool_call.name}: {tool_call.arguments}")

        return True

    except ImportError:
        print("LangChain Anthropic not installed - skipping async test")
        return False
    except Exception as e:
        print(f"Async test failed: {e}")
        return False


def test_convenience_function():
    """Test the convenience function."""
    print("\n=== Testing Convenience Function ===")

    try:
        from langchain_anthropic import ChatAnthropic

        # Create a LangChain model
        langchain_model = ChatAnthropic(model="claude-3-haiku-20240307", temperature=0)

        # Use convenience function
        wrapper = wrap_langchain_model(langchain_model)

        response = wrapper.generate_text("Hello from the convenience function!")
        print(f"Convenience function response: {response}")

        return True

    except ImportError:
        print("LangChain Anthropic not installed - skipping convenience test")
        return False


def test_error_handling():
    """Test error handling with invalid clients."""
    print("\n=== Testing Error Handling ===")

    # Test with invalid client
    try:
        invalid_client = "not a langchain model"
        wrapper = UniversalLLMWrapper(client=invalid_client)
        print("ERROR: Should have failed with invalid client")
        return False
    except ValueError as e:
        print(f"Correctly caught error: {e}")
        return True
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False


def test_adapter_access():
    """Test accessing the underlying adapter and client."""
    print("\n=== Testing Adapter Access ===")

    try:
        from langchain_anthropic import ChatAnthropic

        langchain_model = ChatAnthropic(model="claude-3-haiku-20240307", temperature=0)
        wrapper = UniversalLLMWrapper(langchain_model)

        # Access the adapter
        adapter = wrapper.adapter
        print(f"Adapter type: {type(adapter).__name__}")
        print(f"Adapter model name: {adapter.model_name}")
        print(f"Adapter supports tools: {adapter.supports_tools}")

        # Access the original client
        original_client = wrapper.client
        print(f"Original client type: {type(original_client).__name__}")

        # Test that we can still use the original client directly
        if hasattr(original_client, 'invoke'):
            direct_response = original_client.invoke("Direct call test")
            print(f"Direct client response: {direct_response.content if hasattr(direct_response, 'content') else direct_response}")

        return True

    except ImportError:
        print("LangChain Anthropic not installed - skipping adapter access test")
        return False


async def run_all_tests():
    """Run all tests."""
    print("🚀 Testing Universal LLM Wrapper with LangChain\n")

    results = []

    # Sync tests
    results.append(test_basic_langchain_usage())
    results.append(test_tool_calling())
    results.append(test_convenience_function())
    results.append(test_error_handling())
    results.append(test_adapter_access())

    # Async test
    results.append(await test_async_usage())

    # Summary
    passed = sum(results)
    total = len(results)

    print(f"\n📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed")

    return passed == total


if __name__ == "__main__":
    # Run the tests
    success = asyncio.run(run_all_tests())

    if success:
        print("\n🎉 The LangChain adapter is working well!")
        print("\nNext steps:")
        print("- Try it with your own LangChain models")
        print("- Test with different LangChain model types")
        print("- Experiment with tool calling")
        print("- Consider what other adapters would be useful")
    else:
        print("\n🔧 Some issues to investigate")
