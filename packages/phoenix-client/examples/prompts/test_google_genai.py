import json
import os

from google import genai

from phoenix.client.__generated__ import v1
from phoenix.client.helpers.sdk.google_genai.generate_content import to_chat_messages_and_kwargs


def main() -> None:
    # Create a mock prompt version
    prompt_version_data = v1.PromptVersionData(
        model_provider="GOOGLE",
        model_name="gemini-2.0-flash",
        template=v1.PromptChatTemplate(
            type="chat",
            messages=[
                v1.PromptMessage(role="system", content="You are a helpful assistant."),
                v1.PromptMessage(role="user", content="{{question}}"),
            ],
        ),
        template_type="CHAT",
        template_format="MUSTACHE",
        invocation_parameters=v1.PromptGoogleInvocationParameters(
            type="google",
            google=v1.PromptGoogleInvocationParametersContent(
                temperature=0.7,
                max_output_tokens=256,
            ),
        ),
    )
    print("Prompt version data:")
    print(json.dumps(prompt_version_data, indent=2))

    # Convert to google-genai format
    messages, kwargs = to_chat_messages_and_kwargs(
        prompt_version_data, variables={"question": "What is the capital of France?"}
    )

    print("Messages:")
    print(messages)
    print("Kwargs:")
    print(kwargs)

    # Create the client and call the API
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # Build the generate_content request - kwargs contains model and config
    response = client.models.generate_content(
        contents=messages,
        **kwargs,
    )

    print("\nResponse:")
    print(f"  text: {response.text}")


if __name__ == "__main__":
    main()
